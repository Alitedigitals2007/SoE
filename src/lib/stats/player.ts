import { prisma } from "@/lib/prisma";

/**
 * Player performance stats, aggregated across finished matches: goals,
 * assists, discipline, automatic MOTM count — and the player's share of
 * everything their side produced in those games (contribution percentages).
 */

export type PlayerStats = {
  userId: string;
  /** Finished matches the player was on a roster for. */
  matches: number;
  goals: number;
  assists: number;
  warnings: number;
  yellowCards: number;
  redCards: number;
  /** Automatic Player of the Match awards across all competitions. */
  motm: number;
  /** Goals the player's sides scored in those matches. */
  teamGoals: number;
  /** Assists credited to the player's sides in those matches. */
  teamAssists: number;
  /** Share of the side's goals this player scored (null when none). */
  goalShare: number | null;
  /** Share of the side's assists this player provided (null when none). */
  assistShare: number | null;
};

const pct = (part: number, total: number): number | null => {
  if (total <= 0 || part <= 0) return null;
  return Math.round((part / total) * 100);
};

export async function getPlayerStats(userId: string): Promise<PlayerStats> {
  const slots = await prisma.matchPlayer.findMany({
    where: { userId },
    select: {
      team: true,
      matchId: true,
      match: {
        select: { status: true, homeScore: true, awayScore: true },
      },
    },
  });
  const finished = slots.filter((s) => s.match.status === "FINISHED");
  const finishedIds = finished.map((s) => s.matchId);

  const [goalRounds, incidents, motm] = await Promise.all([
    finishedIds.length
      ? prisma.round.findMany({
          where: { matchId: { in: finishedIds }, status: "DECIDED", decision: "GOAL" },
          select: {
            matchId: true,
            goalSubmission: { select: { player: { select: { userId: true } } } },
            assistPlayer: { select: { userId: true, team: true } },
          },
        })
      : Promise.resolve([]),
    prisma.conductIncident.findMany({
      where: finishedIds.length ? { matchId: { in: finishedIds }, player: { userId } } : { playerId: "—" },
      select: { action: true },
    }),
    prisma.match.count({ where: { motmUserId: userId, status: "FINISHED" } }),
  ]);

  let goals = 0;
  let assists = 0;
  let teamGoals = 0;
  let teamAssists = 0;
  for (const slot of finished) {
    teamGoals += slot.team === "HOME" ? slot.match.homeScore : slot.match.awayScore;
  }
  for (const r of goalRounds) {
    if (r.goalSubmission?.player.userId === userId) goals += 1;
    if (r.assistPlayer) {
      if (r.assistPlayer.userId === userId) assists += 1;
      const mySide = finished.find((s) => s.matchId === r.matchId)?.team;
      if (mySide && r.assistPlayer.team === mySide) teamAssists += 1;
    }
  }

  return {
    userId,
    matches: finished.length,
    goals,
    assists,
    warnings: incidents.filter((i) => i.action === "WARNING").length,
    yellowCards: incidents.filter((i) => i.action === "YELLOW_CARD").length,
    redCards: incidents.filter((i) => i.action === "RED_CARD").length,
    motm,
    teamGoals,
    teamAssists,
    goalShare: pct(goals, teamGoals),
    assistShare: pct(assists, teamAssists),
  };
}

export type MotmLeaderRow = {
  userId: string;
  name: string;
  imageUrl: string | null;
  motm: number;
  points: number;
};

/** MOTM leaderboard across every competition — most awards first. */
export async function getMotmLeaders(take = 10): Promise<MotmLeaderRow[]> {
  const rows = await prisma.match.groupBy({
    by: ["motmUserId"],
    where: { status: "FINISHED", motmUserId: { not: null } },
    _count: { motmUserId: true },
    _sum: { motmScore: true },
  });
  const filtered = rows.filter((r): r is typeof r & { motmUserId: string } => r.motmUserId !== null);
  if (filtered.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: filtered.map((r) => r.motmUserId) } },
    select: { id: true, name: true, imageUrl: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return filtered
    .map((r) => ({
      userId: r.motmUserId,
      name: byId.get(r.motmUserId)?.name ?? "Player",
      imageUrl: byId.get(r.motmUserId)?.imageUrl ?? null,
      motm: r._count.motmUserId,
      points: r._sum.motmScore ?? 0,
    }))
    .sort((a, b) => b.motm - a.motm || b.points - a.points || a.name.localeCompare(b.name))
    .slice(0, take);
}
