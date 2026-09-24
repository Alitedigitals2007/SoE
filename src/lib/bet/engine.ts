import { prisma } from "@/lib/prisma";
import { applyWalletTxn, ensureWallet } from "@/lib/bet/wallet";
import { exactScoreOdds, goalsOdds, oddsForMatch } from "@/lib/bet/odds";
import type { ActionResult, ErrResult } from "@/lib/domain";
import type { Prisma, Bet, BetMarket } from "@prisma/client";

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
export const TOTAL_SELECTIONS = ["O1.5", "U1.5", "O2.5", "U2.5", "O3.5", "U3.5"] as const;

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
  return false;
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
    });
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
    const legOdds = await priceFor(match!, leg.market, leg.selection);
    product *= legOdds;
    legViews.push({
      ...leg,
      odds: legOdds,
      fixture: `${match!.homeName} v ${match!.awayName}`,
    });
  }

  const accaOdds = Math.min(999.99, Math.round(product * 100) / 100);
  const potentialReturn = Math.floor(stake * product);

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
    });
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
 * Returns in-app notifications for the caller to emit after the transaction
 * commits (notifications must not roll back with the data).
 */
export async function settleMatchBets(db: Prisma.TransactionClient, matchId: string): Promise<SettleNotice[]> {
  const notices: SettleNotice[] = [];
  const match = await db.match.findUnique({
    where: { id: matchId },
    select: { id: true, status: true, homeName: true, awayName: true, homeScore: true, awayScore: true },
  });
  if (!match || match.status !== "FINISHED") return notices;
  const score = `${match.homeName} ${match.homeScore}–${match.awayScore} ${match.awayName}`;

  // --- singles & goals markets on this match ---
  const singles = await db.bet.findMany({
    where: { matchId, status: { in: ["PENDING", "WON", "LOST"] }, market: { not: "ACCA" } },
  });
  for (const bet of singles) {
    const won = selectionWins(bet.market, bet.selection, match.homeScore, match.awayScore);
    const outcome = won ? "WON" : "LOST";
    if (bet.status === outcome) continue;

    const odds = Number(bet.odds);
    const label = betLabel(bet.market, bet.selection, `${match.homeName} v ${match.awayName}`);

    if (won) {
      await applyWalletTxn(db, bet.userId, bet.potentialReturn, "BET_WON", `Won: ${label} @ ${odds} — ${score}`, {
        matchId,
        betId: bet.id,
      });
      await db.bet.update({
        where: { id: bet.id },
        data: { status: "WON", payout: bet.potentialReturn, settledAt: new Date() },
      });
      notices.push(notice(bet.userId, true, bet.potentialReturn, `${label} @ ${odds} — ${score}`));
    } else {
      if (bet.status === "WON") {
        await applyWalletTxn(db, bet.userId, -bet.payout, "BET_LOST", `Corrected: ${label} lost — ${score}`, {
          matchId,
          betId: bet.id,
        });
      } else {
        await applyWalletTxn(db, bet.userId, 0, "BET_LOST", `Lost: ${label} @ ${odds} — ${score}`, {
          matchId,
          betId: bet.id,
        });
      }
      await db.bet.update({ where: { id: bet.id }, data: { status: "LOST", payout: 0, settledAt: new Date() } });
      notices.push(notice(bet.userId, false, 0, `${label} @ ${odds} — ${score}`));
    }
  }

  // --- accumulators that include this match ---
  const accas = await db.bet.findMany({
    where: { market: "ACCA", status: "PENDING", legMatchIds: { has: matchId } },
  });
  for (const bet of accas) {
    const legs = (bet.legs ?? []) as AccaLegView[];
    const legMatches = await db.match.findMany({
      where: { id: { in: bet.legMatchIds } },
      select: { id: true, status: true, homeName: true, awayName: true, homeScore: true, awayScore: true },
    });
    const legById = new Map(legMatches.map((m) => [m.id, m]));

    let anyLost = false;
    let allDone = true;
    for (const leg of legs) {
      const lm = legById.get(leg.matchId);
      // Only finished matches can judge a leg — never a live scoreline.
      if (!lm || lm.status !== "FINISHED") {
        allDone = false;
        continue;
      }
      if (!selectionWins(leg.market, leg.selection, lm.homeScore, lm.awayScore)) anyLost = true;
    }

    if (!anyLost && !allDone) continue; // still alive, wait for the remaining legs
    const won = !anyLost && allDone;
    const label = `accumulator (${legs.length} legs @ ${Number(bet.odds)})`;

    if (won) {
      await applyWalletTxn(db, bet.userId, bet.potentialReturn, "BET_WON", `Won: ${label}`, {
        matchId,
        betId: bet.id,
      });
      await db.bet.update({
        where: { id: bet.id },
        data: { status: "WON", payout: bet.potentialReturn, settledAt: new Date() },
      });
      notices.push(notice(bet.userId, true, bet.potentialReturn, `${label} — every leg landed!`));
    } else {
      await applyWalletTxn(db, bet.userId, 0, "BET_LOST", `Lost: ${label}`, { matchId, betId: bet.id });
      await db.bet.update({ where: { id: bet.id }, data: { status: "LOST", payout: 0, settledAt: new Date() } });
      notices.push(notice(bet.userId, false, 0, `${label} — a leg let you down.`));
    }
  }

  return notices;
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
