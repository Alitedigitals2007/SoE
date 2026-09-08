"use server";

import { votePotm, getPotmResults, closePotmVoting, type PotmResult } from "@/lib/match/potm";
import { currentActor } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/domain";

export async function votePotmAction(
  matchId: string,
  playerId: string,
): Promise<ActionResult> {
  const actor = await currentActor();
  if (!actor) return { ok: false, error: "Sign in to vote." };
  return votePotm(matchId, actor.userId, playerId);
}

export async function closePotmVotingAction(code: string): Promise<ActionResult> {
  const actor = await currentActor();
  if (!actor) return { ok: false, error: "Sign in to continue." };
  if (actor.role !== "ADMIN" && actor.role !== "REFEREE")
    return { ok: false, error: "Only a referee or admin can close voting." };
  const match = await prisma.match.findUnique({ where: { code: code.trim().toUpperCase() }, select: { id: true } });
  if (!match) return { ok: false, error: "Match not found." };
  return closePotmVoting(match.id);
}

export async function getPotmResultsAction(
  matchId: string,
): Promise<ActionResult<PotmResult[]>> {
  try {
    const results = await getPotmResults(matchId);
    return { ok: true, data: results };
  } catch (e) {
    console.error("getPotmResultsAction failed", e);
    return { ok: false, error: "Could not load voting results." };
  }
}
