"use server";

import { votePotm, getPotmResults, type PotmResult } from "@/lib/match/potm";
import { currentActor } from "@/lib/session";
import type { ActionResult } from "@/lib/domain";

export async function votePotmAction(
  matchId: string,
  playerId: string,
): Promise<ActionResult> {
  const actor = await currentActor();
  if (!actor) return { ok: false, error: "Sign in to vote." };
  return votePotm(matchId, actor.userId, playerId);
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
