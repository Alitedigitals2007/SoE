import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/domain";

export const POTM_VOTE_WINDOW_MS = 3 * 60 * 1000; // voting stays open for 3 minutes after full time

export async function votePotm(
  matchId: string,
  userId: string,
  playerId: string,
): Promise<ActionResult> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return { ok: false, error: "Match not found." };
  if (match.status !== "FINISHED") return { ok: false, error: "Voting is only available after the match ends." };

  const deadline =
    match.potmClosedAt ??
    (match.finishedAt ? new Date(match.finishedAt.getTime() + POTM_VOTE_WINDOW_MS) : null);
  if (deadline && Date.now() >= deadline.getTime())
    return { ok: false, error: "Player-of-the-Match voting has closed." };

  const playerSlot = await prisma.matchPlayer.findFirst({
    where: { matchId, userId: playerId, role: "STARTER" },
  });
  if (!playerSlot) return { ok: false, error: "Can only vote for players who started the match." };

  try {
    await prisma.potmVote.upsert({
      where: { matchId_userId: { matchId, userId } },
      update: { playerId },
      create: { matchId, userId, playerId },
    });
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Could not record your vote." };
  }
}

export async function closePotmVoting(matchId: string): Promise<ActionResult> {
  const match = await prisma.match.findUnique({ where: { id: matchId }, select: { id: true, status: true } });
  if (!match) return { ok: false, error: "Match not found." };
  if (match.status !== "FINISHED") return { ok: false, error: "Voting opens at full time." };
  await prisma.match.update({ where: { id: match.id }, data: { potmClosedAt: new Date() } });
  return { ok: true, data: undefined };
}

export interface PotmResult {
  playerId: string;
  playerName: string;
  votes: number;
}

export async function getPotmResults(matchId: string): Promise<PotmResult[]> {
  const votes = await prisma.potmVote.groupBy({
    by: ["playerId"],
    where: { matchId },
    _count: { playerId: true },
  });

  if (votes.length === 0) return [];

  const playerIds = votes.map((v) => v.playerId);
  const players = await prisma.user.findMany({
    where: { id: { in: playerIds } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(players.map((p) => [p.id, p.name]));

  return votes
    .map((v) => ({
      playerId: v.playerId,
      playerName: nameMap.get(v.playerId) ?? "Player",
      votes: v._count.playerId,
    }))
    .sort((a, b) => b.votes - a.votes);
}
