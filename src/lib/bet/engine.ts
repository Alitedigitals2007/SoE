import { prisma } from "@/lib/prisma";
import { applyWalletTxn, ensureWallet } from "@/lib/bet/wallet";
import { exactScoreOdds, oddsForMatch } from "@/lib/bet/odds";
import type { ActionResult, ErrResult } from "@/lib/domain";
import type { Prisma, Bet, BetMarket } from "@prisma/client";

const ok = <T>(data: T): { ok: true; data: T } => ({ ok: true, data });
const err = (error: string): ErrResult => ({ ok: false, error });

export type PlaceBetInput = {
  matchId: string;
  market: BetMarket;
  selection: string; // "HOME" | "DRAW" | "AWAY" or "2-1"
  stake: number;
};

const RESULT_SELECTIONS = ["HOME", "DRAW", "AWAY"] as const;
const SCORE_RE = /^(\d)-(\d)$/; // 0–9 goals per side

function betLabel(bet: { market: BetMarket; selection: string; odds: number }, homeName: string, awayName: string): string {
  const fixture = `${homeName} v ${awayName}`;
  if (bet.market === "MATCH_RESULT") {
    const word = { HOME: "home win", DRAW: "draw", AWAY: "away win" }[bet.selection as "HOME" | "DRAW" | "AWAY"] ?? bet.selection;
    return `${word} · ${fixture}`;
  }
  return `score ${bet.selection} · ${fixture}`;
}

/** True when the bet's selection matches the final scoreline. */
function betWins(bet: Pick<Bet, "market" | "selection">, homeScore: number, awayScore: number): boolean {
  if (bet.market === "EXACT_SCORE") {
    const m = SCORE_RE.exec(bet.selection);
    return !!m && Number(m[1]) === homeScore && Number(m[2]) === awayScore;
  }
  if (bet.selection === "HOME") return homeScore > awayScore;
  if (bet.selection === "AWAY") return awayScore > homeScore;
  return homeScore === awayScore;
}

/**
 * Place a single virtual-points bet on an upcoming match. Odds are always
 * re-computed server-side at placement — never trusted from the client.
 */
export async function placeBet(
  actor: { userId: string },
  input: PlaceBetInput,
): Promise<ActionResult<{ balance: number; potentialReturn: number }>> {
  const stake = Math.floor(Number(input.stake));
  if (!Number.isFinite(stake) || stake < 1) return err("Enter a stake of at least 1 point.");
  if (input.market !== "MATCH_RESULT" && input.market !== "EXACT_SCORE") return err("Unknown market.");
  if (input.market === "MATCH_RESULT" && !RESULT_SELECTIONS.includes(input.selection as "HOME"))
    return err("Pick home win, draw or away win.");
  const scoreMatch = input.market === "EXACT_SCORE" ? SCORE_RE.exec(input.selection) : null;
  if (input.market === "EXACT_SCORE" && !scoreMatch) return err("Pick an exact score like 2-1.");

  const match = await prisma.match.findUnique({
    where: { id: input.matchId },
    select: {
      id: true,
      code: true,
      status: true,
      scheduledAt: true,
      homeName: true,
      awayName: true,
      competitionId: true,
      homeTeamId: true,
      awayTeamId: true,
    },
  });
  if (!match) return err("Match not found.");
  if (match.status !== "DRAFT" || !match.scheduledAt) return err("Betting is closed for this match.");

  const RESULT_PRICE_KEY = { HOME: "home", DRAW: "draw", AWAY: "away" } as const;
  const odds =
    input.market === "MATCH_RESULT"
      ? (await oddsForMatch(match))[RESULT_PRICE_KEY[input.selection as "HOME" | "DRAW" | "AWAY"]]
      : await exactScoreOdds(match, Number(scoreMatch![1]), Number(scoreMatch![2]));
  const potentialReturn = Math.floor(stake * odds);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Re-check inside the transaction: kickoff may have happened meanwhile.
      const fresh = await tx.match.findUnique({
        where: { id: match.id },
        select: { status: true, scheduledAt: true },
      });
      if (!fresh || fresh.status !== "DRAFT" || !fresh.scheduledAt) return err("Betting just closed for this match.");

      const { balance } = await ensureWallet(tx, actor.userId);
      if (stake > balance) return err(`Not enough points — your balance is ${balance}.`);

      const label = betLabel({ market: input.market, selection: input.selection, odds }, match.homeName, match.awayName);
      const bet = await tx.bet.create({
        data: {
          userId: actor.userId,
          matchId: match.id,
          market: input.market,
          selection: input.selection,
          odds,
          stake,
          potentialReturn,
        },
        select: { id: true },
      });
      await applyWalletTxn(tx, actor.userId, -stake, "BET_PLACED", `Bet: ${label} · stake ${stake}`, {
        matchId: match.id,
        betId: bet.id,
      });
      const after = await tx.user.findUnique({ where: { id: actor.userId }, select: { virtualPoints: true } });
      return ok({ balance: after?.virtualPoints ?? balance - stake, potentialReturn });
    });
    return result;
  } catch (e) {
    console.error("placeBet failed:", e);
    return err("Could not place the bet, please try again.");
  }
}

/**
 * Settle every bet on a finished match from the current scoreline.
 * Idempotent: re-running adjusts wallets if an admin corrected the score
 * after the original settlement (won→lost debits, lost→won credits).
 */
export async function settleMatchBets(db: Prisma.TransactionClient, matchId: string): Promise<void> {
  const match = await db.match.findUnique({
    where: { id: matchId },
    select: { id: true, status: true, homeName: true, awayName: true, homeScore: true, awayScore: true },
  });
  if (!match || match.status !== "FINISHED") return;

  const bets = await db.bet.findMany({ where: { matchId, status: { in: ["PENDING", "WON", "LOST"] } } });
  const score = `${match.homeName} ${match.homeScore}–${match.awayScore} ${match.awayName}`;

  for (const bet of bets) {
    const won = betWins(bet, match.homeScore, match.awayScore);
    const outcome = won ? "WON" : "LOST";
    if (bet.status === outcome) continue;

    const odds = Number(bet.odds);
    const label = betLabel({ market: bet.market, selection: bet.selection, odds }, match.homeName, match.awayName);

    if (won) {
      await applyWalletTxn(db, bet.userId, bet.potentialReturn, "BET_WON", `Won: ${label} @ ${odds} — ${score}`, {
        matchId,
        betId: bet.id,
      });
      await db.bet.update({
        where: { id: bet.id },
        data: { status: "WON", payout: bet.potentialReturn, settledAt: new Date() },
      });
    } else {
      if (bet.status === "WON") {
        // Score correction after settlement — take the winnings back.
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
    }
  }
}
