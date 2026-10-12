import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Automatic Player of the Match, decided by performance — not by votes.
 *
 *   goal            +3
 *   assist          +2
 *   yellow card     -1
 *   red card        -3
 *   deciding goal   +1   (the winning goal in a one-goal game)
 *
 * The winner is the roster player with the highest total; ties break on
 * goals, then assists, then name. Nobody scores below zero and a match
 * where nobody reaches a positive point has no MOTM at all.
 */

export const MOTM_GOAL_POINTS = 3;
export const MOTM_ASSIST_POINTS = 2;
export const MOTM_YELLOW_POINTS = -1;
export const MOTM_RED_POINTS = -3;
export const MOTM_DECIDING_GOAL_BONUS = 1;

export type MotmBreakdown = {
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  decidingGoal: boolean;
};

export type MotmCandidate = MotmBreakdown & {
  userId: string;
  name: string;
  points: number;
};

type Db = Prisma.TransactionClient | PrismaClient;

type MotmInput = {
  homeScore: number;
  awayScore: number;
  roster: { userId: string; team: "HOME" | "AWAY"; user: { id: string; name: string } }[];
  rounds: {
    decision: string | null;
    goalSubmission: { player: { userId: string } } | null;
    assistPlayer: { userId: string } | null;
  }[];
  incidents: { action: string; player: { userId: string } }[];
};

/**
 * Score every roster player from the decided rounds and recorded incidents.
 * `decidingGoal` marks the winning side's last goal when the final margin is
 * exactly one — the strike that settled the game.
 */
export function scoreMotm(match: MotmInput): MotmCandidate[] {
  const byUser = new Map<string, MotmCandidate>();
  const sideOf = new Map<string, "HOME" | "AWAY">(match.roster.map((r) => [r.userId, r.team]));
  const slotOf = (userId: string): MotmCandidate | null => {
    let c = byUser.get(userId);
    if (!c) {
      const slot = match.roster.find((r) => r.userId === userId);
      if (!slot) return null;
      c = { userId, name: slot.user.name, goals: 0, assists: 0, yellowCards: 0, redCards: 0, decidingGoal: false, points: 0 };
      byUser.set(userId, c);
    }
    return c;
  };

  for (const r of match.rounds) {
    if (r.decision !== "GOAL" || !r.goalSubmission) continue;
    const scorer = slotOf(r.goalSubmission.player.userId);
    if (scorer) {
      scorer.goals += 1;
      scorer.points += MOTM_GOAL_POINTS;
    }
    const assist = r.assistPlayer ? slotOf(r.assistPlayer.userId) : null;
    if (assist) {
      assist.assists += 1;
      assist.points += MOTM_ASSIST_POINTS;
    }
  }

  const margin = match.homeScore - match.awayScore;
  if (Math.abs(margin) === 1) {
    const winnerSide: "HOME" | "AWAY" = margin > 0 ? "HOME" : "AWAY";
    const winnerGoalRounds = match.rounds.filter(
      (r) => r.decision === "GOAL" && r.goalSubmission && sideOf.get(r.goalSubmission.player.userId) === winnerSide,
    );
    const deciding = winnerGoalRounds[winnerGoalRounds.length - 1];
    if (deciding) {
      const c = slotOf(deciding.goalSubmission!.player.userId);
      if (c) {
        c.decidingGoal = true;
        c.points += MOTM_DECIDING_GOAL_BONUS;
      }
    }
  }

  for (const inc of match.incidents) {
    const c = slotOf(inc.player.userId);
    if (!c) continue;
    if (inc.action === "YELLOW_CARD") {
      c.yellowCards += 1;
      c.points += MOTM_YELLOW_POINTS;
    } else if (inc.action === "RED_CARD") {
      c.redCards += 1;
      c.points += MOTM_RED_POINTS;
    }
  }

  for (const c of byUser.values()) c.points = Math.max(0, c.points);
  return [...byUser.values()].sort(
    (a, b) => b.points - a.points || b.goals - a.goals || b.assists - a.assists || a.name.localeCompare(b.name),
  );
}

export type StoredMotm = { userId: string; name: string; points: number; breakdown: MotmBreakdown };

/**
 * Pick the MOTM for a stored match and persist the winner. Idempotent:
 * recomputing overwrites the stored choice (used by backfill and by score
 * corrections). Returns null when the match isn't finished or nobody earned
 * a positive score.
 */
export async function computeAndStoreMotm(db: Db, matchId: string): Promise<StoredMotm | null> {
  const match = await db.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      status: true,
      homeScore: true,
      awayScore: true,
      roster: { select: { userId: true, team: true, user: { select: { id: true, name: true } } } },
      rounds: {
        where: { status: "DECIDED" },
        select: {
          decision: true,
          goalSubmission: { select: { player: { select: { userId: true } } } },
          assistPlayer: { select: { userId: true } },
        },
      },
      incidents: { select: { action: true, player: { select: { userId: true } } } },
    },
  });
  if (!match || match.status !== "FINISHED") return null;

  const candidates = scoreMotm(match);
  const winner = candidates.find((c) => c.points > 0) ?? null;
  const motmComputedAt = new Date();
  if (!winner) {
    await db.match.update({
      where: { id: matchId },
      data: { motmUserId: null, motmScore: null, motmComputedAt },
    });
    return null;
  }
  await db.match.update({
    where: { id: matchId },
    data: { motmUserId: winner.userId, motmScore: winner.points, motmComputedAt },
  });
  const { userId, name, points, ...breakdown } = winner;
  return { userId, name, points, breakdown };
}

/**
 * Backfill automatic MOTM for finished matches that don't have one yet
 * (every match finished before the system existed). Returns how many
 * matches gained a MOTM.
 */
export async function backfillMotm(limit = 500): Promise<number> {
  const { prisma } = await import("@/lib/prisma");
  const pending = await prisma.match.findMany({
    where: { status: "FINISHED", motmComputedAt: null },
    select: { id: true },
    orderBy: { finishedAt: "asc" },
    take: limit,
  });
  let filled = 0;
  for (const m of pending) {
    const result = await computeAndStoreMotm(prisma, m.id);
    if (result) filled += 1;
  }
  return filled;
}
