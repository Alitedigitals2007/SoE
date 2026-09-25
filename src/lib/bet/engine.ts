import { prisma, TX_OPTS } from "@/lib/prisma";
import { applyWalletChanges, applyWalletTxn, ensureWallet } from "@/lib/bet/wallet";
import { doubleChanceOdds, drawNoBetOdds, exactScoreOdds, goalsOdds, halfFullOdds, halfResultOdds, oddsForMatch, teamTotalsOdds } from "@/lib/bet/odds";
import { MAX_ODDS } from "@/lib/bet/pricing";
import type { ActionResult, ErrResult } from "@/lib/domain";
import { HALFTIME_AFTER_QUESTION } from "@/lib/domain";
import { generateShareCode } from "@/lib/matchCode";
import type { Prisma, PrismaClient, Bet, BetMarket, WalletTxnKind } from "@prisma/client";

const ok = <T>(data: T): { ok: true; data: T } => ({ ok: true, data });
const err = (error: string): ErrResult => ({ ok: false, error });

/* --------------------------------- limits ---------------------------------- */

export const MAX_STAKE_POINTS = 500; // hard cap per bet (keeps the economy sane)
export const MAX_PENDING_PER_MATCH = 5; // open singles on one match
export const MAX_ACCA_LEGS = 6;
export const MAX_PENDING_ACCAS = 10;
export const DAILY_CLAIM_POINTS = 20;

/* --------------------------------- helpers --------------------------------- */

const SCORE_RE = /^(\d{1,2})-(\d{1,2})$/;
export const TOTAL_SELECTIONS = ["O0.5", "U0.5", "O1.5", "U1.5", "O2.5", "U2.5", "O3.5", "U3.5", "O4.5", "U4.5"] as const;
export const DOUBLE_CHANCE_SELECTIONS = ["1X", "X2", "12"] as const;
export const DRAW_NO_BET_SELECTIONS = ["HOME", "AWAY"] as const;
export const HALF_RESULT_SELECTIONS = ["HOME", "DRAW", "AWAY"] as const;
export const HALF_FULL_SELECTIONS = ["HH", "HD", "HA", "DH", "DD", "DA", "AH", "AD", "AA"] as const;
/** Per-team goal lines, e.g. "H_O2.5" (home scores 3+) or "A_U1.5" (away 0–1). */
export const TEAM_TOTAL_LINES_VIEW = [0.5, 1.5, 2.5, 3.5] as const;
export const TEAM_TOTAL_SELECTIONS = [
  ...TEAM_TOTAL_LINES_VIEW.flatMap((l) => [`H_O${l}`, `H_U${l}`]),
  ...TEAM_TOTAL_LINES_VIEW.flatMap((l) => [`A_O${l}`, `A_U${l}`]),
] as const;

type MatchRow = {
  id: string;
  code: string;
  status: string;
  scheduledAt: Date | null;
  homeName: string;
  awayName: string;
  competitionId: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
};

export type PlaceBetInput = {
  matchId: string;
  market: BetMarket;
  selection: string; // "HOME" | "2-1" | "O2.5" | "YES" …
  stake: number;
};

export type AccaLeg = { matchId: string; market: BetMarket; selection: string };

export type SettleNotice = { userId: string; title: string; body: string; link: string };

export type AccaLegView = AccaLeg & { odds: number; fixture: string };

/** Selection syntax check per market. Returns an error message or null. */
function validateSelection(market: BetMarket, selection: string): string | null {
  if (market === "MATCH_RESULT") {
    return ["HOME", "DRAW", "AWAY"].includes(selection) ? null : "Pick home win, draw or away win.";
  }
  if (market === "EXACT_SCORE") {
    const m = SCORE_RE.exec(selection);
    if (!m) return "Pick an exact score like 2-1.";
    const h = Number(m[1]);
    const a = Number(m[2]);
    // A match has ten questions → at most ten goals in total.
    if (h > 10 || a > 10 || h + a > 10)
      return "Scores run 0–10 per side, and a match can't produce more than 10 goals in total.";
    return null;
  }
  if (market === "TOTAL_GOALS") {
    return (TOTAL_SELECTIONS as readonly string[]).includes(selection) ? null : "Pick an over/under goals line.";
  }
  if (market === "BOTH_TEAMS_TO_SCORE") {
    return selection === "YES" || selection === "NO" ? null : "Pick yes or no.";
  }
  if (market === "DOUBLE_CHANCE") {
    return (DOUBLE_CHANCE_SELECTIONS as readonly string[]).includes(selection)
      ? null
      : "Pick 1X, X2 or 12.";
  }
  if (market === "DRAW_NO_BET") {
    return (DRAW_NO_BET_SELECTIONS as readonly string[]).includes(selection)
      ? null
      : "Pick home or away — a draw refunds your stake.";
  }
  if (market === "HALF_RESULT") {
    return (HALF_RESULT_SELECTIONS as readonly string[]).includes(selection)
      ? null
      : "Pick the half-time result.";
  }
  if (market === "HALF_FULL") {
    return (HALF_FULL_SELECTIONS as readonly string[]).includes(selection)
      ? null
      : "Pick a half-time/full-time combo like HD (draw at half, home win at full).";
  }
  if (market === "TEAM_TOTALS") {
    return (TEAM_TOTAL_SELECTIONS as readonly string[]).includes(selection)
      ? null
      : "Pick a team total, e.g. H_O2.5 or A_U1.5.";
  }
  if (market === "ACCA") return null;
  return "Unknown market.";
}

/** Server-side price for any single-market selection (never trust the client). */
async function priceFor(match: MatchRow, market: BetMarket, selection: string): Promise<number> {
  if (market === "MATCH_RESULT") {
    const key = { HOME: "home", DRAW: "draw", AWAY: "away" } as const;
    return (await oddsForMatch(match))[key[selection as "HOME" | "DRAW" | "AWAY"]];
  }
  if (market === "EXACT_SCORE") {
    const m = SCORE_RE.exec(selection)!;
    return exactScoreOdds(match, Number(m[1]), Number(m[2]));
  }
  if (market === "DOUBLE_CHANCE") {
    const o = await doubleChanceOdds(match);
    return o[selection as "1X" | "X2" | "12"];
  }
  if (market === "DRAW_NO_BET") {
    const o = await drawNoBetOdds(match);
    return o[selection as "HOME" | "AWAY"];
  }
  if (market === "HALF_RESULT") {
    const o = await halfResultOdds(match);
    return o[selection as "HOME" | "DRAW" | "AWAY"];
  }
  if (market === "HALF_FULL") {
    const o = await halfFullOdds(match);
    return o[selection];
  }
  if (market === "TEAM_TOTALS") {
    const totals = await teamTotalsOdds(match);
    const side = selection.startsWith("H_") ? "HOME" : "AWAY";
    const line = Number(selection.slice(3));
    const row = totals[side].find((l) => l.line === line);
    if (!row) throw new Error("Unknown team total line.");
    return selection.includes("_O") ? row.over : row.under;
  }
  const g = await goalsOdds(match);
  if (market === "BOTH_TEAMS_TO_SCORE") return selection === "YES" ? g.btts.yes : g.btts.no;
  const line = g.lines.find((l) => `O${l.line}` === selection || `U${l.line}` === selection);
  if (!line) throw new Error("Unknown goals line.");
  return selection.startsWith("O") ? line.over : line.under;
}

function betLabel(market: BetMarket, selection: string, fixture: string): string {
  if (market === "MATCH_RESULT") {
    const word = { HOME: "home win", DRAW: "draw", AWAY: "away win" }[selection as "HOME" | "DRAW" | "AWAY"] ?? selection;
    return `${word} · ${fixture}`;
  }
  if (market === "EXACT_SCORE") return `score ${selection} · ${fixture}`;
  if (market === "TOTAL_GOALS") {
    const word = selection.startsWith("O") ? `over ${selection.slice(1)} goals` : `under ${selection.slice(1)} goals`;
    return `${word} · ${fixture}`;
  }
  if (market === "BOTH_TEAMS_TO_SCORE") return `both teams to score ${selection === "YES" ? "(yes)" : "(no)"} · ${fixture}`;
  if (market === "DOUBLE_CHANCE") {
    const word = { "1X": "home or draw", X2: "draw or away", "12": "either team to win" }[selection as "1X" | "X2" | "12"] ?? selection;
    return `double chance ${selection} (${word}) · ${fixture}`;
  }
  if (market === "DRAW_NO_BET") {
    const word = selection === "HOME" ? "home win" : "away win";
    return `draw no bet — ${word} · ${fixture}`;
  }
  if (market === "HALF_RESULT") {
    const word = { HOME: "home lead", DRAW: "scores level", AWAY: "away lead" }[selection as "HOME" | "DRAW" | "AWAY"] ?? selection;
    return `half-time ${word} · ${fixture}`;
  }
  if (market === "HALF_FULL") {
    const [ht, ft] = selection.split("");
    const word = (r: string) => (r === "H" ? "home" : r === "A" ? "away" : "draw");
    return `half-time ${word(ht)} / full-time ${word(ft)} · ${fixture}`;
  }
  if (market === "TEAM_TOTALS") {
    const side = selection.startsWith("H_") ? "home" : "away";
    const over = selection.includes("_O");
    const line = selection.slice(3);
    return `${side} team ${over ? "over" : "under"} ${line} goals · ${fixture}`;
  }
  return `accumulator · ${fixture}`;
}

/** Win check for a finished scoreline (single markets only — accas compose these). */
export function selectionWins(market: BetMarket, selection: string, homeScore: number, awayScore: number): boolean {
  if (market === "EXACT_SCORE") {
    const m = SCORE_RE.exec(selection);
    return !!m && Number(m[1]) === homeScore && Number(m[2]) === awayScore;
  }
  if (market === "MATCH_RESULT") {
    if (selection === "HOME") return homeScore > awayScore;
    if (selection === "AWAY") return awayScore > homeScore;
    return homeScore === awayScore;
  }
  if (market === "TOTAL_GOALS") {
    const total = homeScore + awayScore;
    const line = Number(selection.slice(1));
    return selection.startsWith("O") ? total > line : total < line;
  }
  if (market === "BOTH_TEAMS_TO_SCORE") {
    const both = homeScore >= 1 && awayScore >= 1;
    return selection === "YES" ? both : !both;
  }
  if (market === "DOUBLE_CHANCE") {
    const homeWin = homeScore > awayScore;
    const awayWin = awayScore > homeScore;
    const draw = homeScore === awayScore;
    if (selection === "1X") return homeWin || draw;
    if (selection === "X2") return draw || awayWin;
    return homeWin || awayWin; // "12" — either team to win
  }
  if (market === "TEAM_TOTALS") {
    // Selections look like "H_O2.5" (home scores 3+) or "A_U1.5" (away 0-1).
    const scored = selection.startsWith("H") ? homeScore : awayScore;
    const line = Number(selection.slice(3));
    if (!Number.isFinite(line)) return false;
    return selection.includes("_O") ? scored > line : scored < line;
  }
  return false;
}

/* ------------------------------ outcome logic ------------------------------ */

export type BetOutcome = "WON" | "LOST" | "VOID";

const resultKeyOf = (home: number, away: number): "H" | "D" | "A" =>
  home > away ? "H" : home < away ? "A" : "D";

/**
 * Half-time scoreline, derived from the first five decided rounds (the break
 * always lands after question five). Returns null when those rounds do not
 * exist — e.g. a walkover that was recorded without playing — in which case
 * half-time markets are voided rather than guessed.
 */
export async function halfTimeScore(
  db: Prisma.TransactionClient | PrismaClient,
  matchId: string,
): Promise<{ home: number; away: number } | null> {
  const rounds = await db.round.findMany({
    where: { matchId, status: "DECIDED", number: { lte: HALFTIME_AFTER_QUESTION } },
    select: { decision: true, goalSubmission: { select: { player: { select: { team: true } } } } },
  });
  if (rounds.length === 0) return null;
  let home = 0;
  let away = 0;
  for (const r of rounds) {
    if (r.decision !== "GOAL" || !r.goalSubmission) continue;
    if (r.goalSubmission.player.team === "HOME") home++;
    else away++;
  }
  return { home, away };
}

/**
 * Judge a selection against a finished scoreline.
 * Draw-no-bet returns VOID on a draw (stake refunded); half-time markets are
 * VOID when the break never produced a scoreline to judge them on.
 */
export function selectionOutcome(
  market: BetMarket,
  selection: string,
  score: { home: number; away: number; ht: { home: number; away: number } | null },
): BetOutcome {
  if (market === "DRAW_NO_BET") {
    if (score.home === score.away) return "VOID";
    const homeWon = score.home > score.away;
    return (selection === "HOME") === homeWon ? "WON" : "LOST";
  }
  if (market === "HALF_RESULT" || market === "HALF_FULL") {
    if (!score.ht) return "VOID";
    const htKey = resultKeyOf(score.ht.home, score.ht.away);
    if (market === "HALF_RESULT") {
      const want = selection === "HOME" ? "H" : selection === "AWAY" ? "A" : "D";
      return htKey === want ? "WON" : "LOST";
    }
    const ftKey = resultKeyOf(score.home, score.away);
    return selection === `${htKey}${ftKey}` ? "WON" : "LOST";
  }
  return selectionWins(market, selection, score.home, score.away) ? "WON" : "LOST";
}

/** What a settled bet pays out: winnings, a refunded stake, or nothing. */
export function payoutFor(outcome: BetOutcome | "PENDING", stake: number, potentialReturn: number): number {
  if (outcome === "WON") return potentialReturn;
  if (outcome === "VOID") return stake;
  return 0;
}

/* -------------------------------- placement -------------------------------- */

async function assertBetable(match: MatchRow | null | undefined): Promise<ErrResult | null> {
  if (!match) return err("Match not found.");
  if (match.status !== "DRAFT" || !match.scheduledAt) return err("Betting is closed for this match.");
  return null;
}

/** Place a single virtual-points bet. Odds are re-computed server-side. */
export async function placeBet(
  actor: { userId: string },
  input: PlaceBetInput,
): Promise<ActionResult<{ balance: number; potentialReturn: number }>> {
  const stake = Math.floor(Number(input.stake));
  if (!Number.isFinite(stake) || stake < 1) return err("Enter a stake of at least 1 point.");
  if (stake > MAX_STAKE_POINTS) return err(`The maximum stake per bet is ${MAX_STAKE_POINTS} points.`);
  const selectionError = validateSelection(input.market, input.selection);
  if (selectionError) return err(selectionError);

  const match = await prisma.match.findUnique({ where: { id: input.matchId } });
  const notBetable = await assertBetable(match);
  if (notBetable) return notBetable;

  const openCount = await prisma.bet.count({
    where: { userId: actor.userId, matchId: match!.id, market: { not: "ACCA" }, status: "PENDING" },
  });
  if (openCount >= MAX_PENDING_PER_MATCH)
    return err(`You already have ${MAX_PENDING_PER_MATCH} open bets on this match.`);

  const odds = await priceFor(match!, input.market, input.selection);
  const potentialReturn = Math.floor(stake * odds);
  const label = betLabel(input.market, input.selection, `${match!.homeName} v ${match!.awayName}`);

  try {
    return await prisma.$transaction(async (tx) => {
      const fresh = await tx.match.findUnique({ where: { id: match!.id }, select: { status: true, scheduledAt: true } });
      if (!fresh || fresh.status !== "DRAFT" || !fresh.scheduledAt) return err("Betting just closed for this match.");

      const { balance } = await ensureWallet(tx, actor.userId);
      if (stake > balance) return err(`Not enough points — your balance is ${balance}.`);

      const bet = await tx.bet.create({
        data: {
          code: generateShareCode(),
          userId: actor.userId,
          matchId: match!.id,
          market: input.market,
          selection: input.selection,
          odds,
          stake,
          potentialReturn,
        },
        select: { id: true },
      });
      await applyWalletTxn(tx, actor.userId, -stake, "BET_PLACED", `Bet: ${label} · stake ${stake}`, {
        matchId: match!.id,
        betId: bet.id,
      });
      const after = await tx.user.findUnique({ where: { id: actor.userId }, select: { virtualPoints: true } });
      return ok({ balance: after?.virtualPoints ?? balance - stake, potentialReturn });
    }, TX_OPTS);
  } catch (e) {
    console.error("placeBet failed:", e);
    return err("Could not place the bet, please try again.");
  }
}

/** Place an accumulator across 2–6 matches in one slip. */
export async function placeAcca(
  actor: { userId: string },
  input: { legs: AccaLeg[]; stake: number },
): Promise<ActionResult<{ balance: number; potentialReturn: number; odds: number }>> {
  const stake = Math.floor(Number(input.stake));
  if (!Number.isFinite(stake) || stake < 1) return err("Enter a stake of at least 1 point.");
  if (stake > MAX_STAKE_POINTS) return err(`The maximum stake per bet is ${MAX_STAKE_POINTS} points.`);

  const legs = input.legs ?? [];
  if (legs.length < 2) return err("An accumulator needs at least 2 selections.");
  if (legs.length > MAX_ACCA_LEGS) return err(`Accumulators are capped at ${MAX_ACCA_LEGS} legs.`);
  if (new Set(legs.map((l) => l.matchId)).size !== legs.length)
    return err("Pick each match only once in an accumulator.");

  const matches = await prisma.match.findMany({ where: { id: { in: legs.map((l) => l.matchId) } } });
  const byId = new Map(matches.map((m) => [m.id, m]));
  const legViews: AccaLegView[] = [];
  let product = 1;
  for (const leg of legs) {
    const match = byId.get(leg.matchId);
    const notBetable = await assertBetable(match);
    if (notBetable) return notBetable;
    const selectionError = validateSelection(leg.market, leg.selection);
    if (selectionError) return err(selectionError);
    if (leg.market === "DRAW_NO_BET")
      return err("Draw-no-bet can't go in an accumulator — a draw would void the whole slip. Place it as a single bet.");
    const legOdds = await priceFor(match!, leg.market, leg.selection);
    product *= legOdds;
    legViews.push({
      ...leg,
      odds: legOdds,
      fixture: `${match!.homeName} v ${match!.awayName}`,
    });
  }

  const accaOdds = Math.min(MAX_ODDS, Math.round(product * 100) / 100);
  // Capped odds — matches the slip the user saw and keeps the return inside Int.
  const potentialReturn = Math.floor(stake * accaOdds);

  const openAccas = await prisma.bet.count({ where: { userId: actor.userId, market: "ACCA", status: "PENDING" } });
  if (openAccas >= MAX_PENDING_ACCAS) return err(`You already have ${MAX_PENDING_ACCAS} open accumulators.`);

  try {
    return await prisma.$transaction(async (tx) => {
      for (const leg of legs) {
        const fresh = await tx.match.findUnique({ where: { id: leg.matchId }, select: { status: true, scheduledAt: true } });
        if (!fresh || fresh.status !== "DRAFT" || !fresh.scheduledAt) return err("Betting just closed on one of your selections.");
      }

      const { balance } = await ensureWallet(tx, actor.userId);
      if (stake > balance) return err(`Not enough points — your balance is ${balance}.`);

      const anchor = legViews[0];
      const bet = await tx.bet.create({
        data: {
          code: generateShareCode(),
          userId: actor.userId,
          matchId: anchor.matchId,
          market: "ACCA",
          selection: "ACCA",
          odds: accaOdds,
          stake,
          potentialReturn,
          legs: legViews as unknown as Prisma.InputJsonValue,
          legMatchIds: legs.map((l) => l.matchId),
        },
        select: { id: true },
      });
      const label = `accumulator (${legs.length} legs @ ${accaOdds})`;
      await applyWalletTxn(tx, actor.userId, -stake, "BET_PLACED", `Bet: ${label} · stake ${stake}`, {
        matchId: anchor.matchId,
        betId: bet.id,
      });
      const after = await tx.user.findUnique({ where: { id: actor.userId }, select: { virtualPoints: true } });
      return ok({ balance: after?.virtualPoints ?? balance - stake, potentialReturn, odds: accaOdds });
    }, TX_OPTS);
  } catch (e) {
    console.error("placeAcca failed:", e);
    return err("Could not place the accumulator, please try again.");
  }
}

/* ------------------------------- daily claim ------------------------------- */

export async function claimDaily(actor: { userId: string }): Promise<ActionResult<{ balance: number }>> {
  try {
    const last = await prisma.walletTransaction.findFirst({
      where: { userId: actor.userId, kind: "DAILY_CLAIM" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (last && last.createdAt.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10))
      return err("You already claimed today — come back tomorrow.");

    const balance = await applyWalletTxn(
      prisma,
      actor.userId,
      DAILY_CLAIM_POINTS,
      "DAILY_CLAIM",
      `Daily claim +${DAILY_CLAIM_POINTS} points`,
    );
    return ok({ balance });
  } catch (e) {
    console.error("claimDaily failed:", e);
    return err("Could not claim your points, please try again.");
  }
}

/* ------------------------------- settlement -------------------------------- */

function notice(userId: string, won: boolean, pts: number, body: string): SettleNotice {
  return won
    ? { userId, title: `Bet won +${pts} pts`, body, link: "/bet" }
    : { userId, title: "Bet lost", body, link: "/bet" };
}

/**
 * Settle every bet touching a finished match. Idempotent: re-running adjusts
 * wallets when an admin corrected the score after the original settlement.
 * Every bet is judged BEFORE anything is written (consistent reads), the wallet
 * movements are applied in one batch, then the bet rows are flipped — so the
 * round-trip count stays flat and the caller's transaction cannot time out.
 * Returns in-app notifications for the caller to emit after the transaction
 * commits (notifications must not roll back with the data).
 */
export async function settleMatchBets(db: Prisma.TransactionClient, matchId: string): Promise<SettleNotice[]> {
  const match = await db.match.findUnique({
    where: { id: matchId },
    select: { id: true, status: true, homeName: true, awayName: true, homeScore: true, awayScore: true },
  });
  if (!match || match.status !== "FINISHED") return [];
  const score = `${match.homeName} ${match.homeScore}–${match.awayScore} ${match.awayName}`;
  const finalScore = { home: match.homeScore, away: match.awayScore };
  const ht = await halfTimeScore(db, matchId);
  const fixture = `${match.homeName} v ${match.awayName}`;
  const settledAt = new Date();

  /** One settled bet: the row flip, its wallet movement and the user notice. */
  type SettleAction = {
    betId: string;
    userId: string;
    outcome: BetOutcome;
    payout: number;
    amount: number;
    kind: WalletTxnKind;
    note: string;
    notice: SettleNotice;
  };
  const actions: SettleAction[] = [];

  // --- singles & goals markets on this match ---
  const singles = await db.bet.findMany({
    where: { matchId, status: { in: ["PENDING", "WON", "LOST", "VOID"] }, market: { not: "ACCA" } },
  });
  for (const bet of singles) {
    const outcome = selectionOutcome(bet.market, bet.selection, { ...finalScore, ht });
    const nextPayout = payoutFor(outcome, bet.stake, bet.potentialReturn);
    const prevPayout = payoutFor(bet.status as BetOutcome, bet.stake, bet.potentialReturn);
    // Already settled correctly — and the payout agrees (idempotent re-runs).
    if (bet.status === outcome && bet.payout === nextPayout) continue;

    const delta = nextPayout - prevPayout;
    const odds = Number(bet.odds);
    const label = betLabel(bet.market, bet.selection, fixture);
    const kind = delta > 0 ? (outcome === "VOID" ? "BET_VOID" : "BET_WON") : "BET_LOST";
    const note =
      outcome === "WON"
        ? `Won: ${label} @ ${odds} — ${score}`
        : outcome === "VOID"
          ? `Void: ${label} — stake refunded — ${score}`
          : bet.status === "WON"
            ? `Corrected: ${label} lost — ${score}`
            : `Lost: ${label} @ ${odds} — ${score}`;
    actions.push({
      betId: bet.id,
      userId: bet.userId,
      outcome,
      payout: nextPayout,
      amount: delta,
      kind,
      note,
      notice:
        outcome === "VOID"
          ? { userId: bet.userId, title: `Bet void +${bet.stake} pts`, body: `${label} — ${score}`, link: "/bet" }
          : notice(bet.userId, outcome === "WON", nextPayout, `${label} @ ${odds} — ${score}`),
    });
  }

  // --- accumulators that include this match ---
  const accas = await db.bet.findMany({
    where: { market: "ACCA", status: { in: ["PENDING", "WON", "LOST", "VOID"] }, legMatchIds: { has: matchId } },
  });
  for (const bet of accas) {
    const legs = (bet.legs ?? []) as AccaLegView[];
    const legMatches = await db.match.findMany({
      where: { id: { in: bet.legMatchIds } },
      select: { id: true, status: true, homeName: true, awayName: true, homeScore: true, awayScore: true },
    });
    const legById = new Map(legMatches.map((m) => [m.id, m]));

    const legOutcomes: (BetOutcome | null)[] = [];
    for (const leg of legs) {
      const lm = legById.get(leg.matchId);
      // Only finished matches can judge a leg — never a live scoreline.
      if (!lm || lm.status !== "FINISHED") {
        legOutcomes.push(null);
        continue;
      }
      const legHt = needsHalfTime(leg.market) ? await halfTimeScore(db, leg.matchId) : null;
      legOutcomes.push(
        selectionOutcome(leg.market, leg.selection, {
          home: lm.homeScore,
          away: lm.awayScore,
          ht: legHt,
        }),
      );
    }

    const aggregated = accaOutcome(legOutcomes);
    if (aggregated === "PENDING") continue; // still alive, wait for the remaining legs
    const outcome: BetOutcome = aggregated;
    const nextPayout = payoutFor(outcome, bet.stake, bet.potentialReturn);
    const prevPayout = payoutFor(bet.status as BetOutcome, bet.stake, bet.potentialReturn);
    if (bet.status === outcome && bet.payout === nextPayout) continue;

    const delta = nextPayout - prevPayout;
    const label = `accumulator (${legs.length} legs @ ${Number(bet.odds)})`;
    const kind = delta > 0 ? (outcome === "VOID" ? "BET_VOID" : "BET_WON") : "BET_LOST";
    actions.push({
      betId: bet.id,
      userId: bet.userId,
      outcome,
      payout: nextPayout,
      amount: delta,
      kind,
      note:
        outcome === "VOID" ? `Void: ${label} — stake refunded` : outcome === "WON" ? `Won: ${label}` : `Lost: ${label}`,
      notice:
        outcome === "VOID"
          ? { userId: bet.userId, title: `Acca void +${bet.stake} pts`, body: `${label} — a leg was voided.`, link: "/bet" }
          : outcome === "WON"
            ? notice(bet.userId, true, nextPayout, `${label} — every leg landed!`)
            : notice(bet.userId, false, 0, `${label} — a leg let you down.`),
    });
  }
  if (actions.length === 0) return [];

  // --- wallets in one batch, then flip the bet rows ---
  await applyWalletChanges(
    db,
    actions.map((a) => ({ userId: a.userId, amount: a.amount, kind: a.kind, note: a.note, matchId, betId: a.betId })),
  );
  for (const a of actions) {
    await db.bet.update({
      where: { id: a.betId },
      data: { status: a.outcome, payout: a.payout, settledAt },
    });
  }
  return actions.map((a) => a.notice);
}

/**
 * Aggregate leg results into an accumulator's outcome.
 * `null` = the leg's match hasn't finished yet. A single losing leg kills the
 * acca even if other legs are still open; otherwise the slip waits until every
 * leg is decided, and is voided (stake refunded) when a leg was voided.
 */
export function accaOutcome(legOutcomes: (BetOutcome | null)[]): BetOutcome | "PENDING" {
  let anyLost = false;
  let anyVoid = false;
  let allDone = true;
  for (const o of legOutcomes) {
    if (o === null) allDone = false;
    else if (o === "LOST") anyLost = true;
    else if (o === "VOID") anyVoid = true;
  }
  if (anyLost) return "LOST";
  if (!allDone) return "PENDING";
  return anyVoid ? "VOID" : "WON";
}

/** Markets that need a half-time scoreline to be judged. */
function needsHalfTime(market: BetMarket): boolean {
  return market === "HALF_RESULT" || market === "HALF_FULL";
}

/** Fire settlement notifications (call AFTER the settlement transaction commits). */
export async function emitSettleNotices(notices: SettleNotice[]): Promise<void> {
  if (!notices.length) return;
  try {
    await prisma.notification.createMany({
      data: notices.map((n) => ({ userId: n.userId, title: n.title, body: n.body, link: n.link })),
    });
  } catch (e) {
    console.error("emitSettleNotices failed:", e);
  }
}

/** Convenience for pages: label used across the UI. */
export function displayLabel(bet: Pick<Bet, "market" | "selection">, homeName: string, awayName: string): string {
  return betLabel(bet.market, bet.selection, `${homeName} v ${awayName}`);
}
