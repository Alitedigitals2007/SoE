import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/domain";

export async function votePotm(
  matchId: string,
  userId: string,
  playerId: string,
): Promise<ActionResult> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return { ok: false, error: "Match not found." };
  if (match.status !== "FINISHED") return { ok: false, error: "Voting is only available after the match ends." };

  const voterSlot = await prisma.matchPlayer.findFirst({
    where: { matchId, userId },
  });
  if (!voterSlot) return { ok: false, error: "You are not part of this match." };

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
