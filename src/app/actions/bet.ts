"use server";

import { Prisma } from "@prisma/client";
import { claimDaily, placeAcca, placeBet, type AccaLeg, type PlaceBetInput } from "@/lib/bet/engine";
import { liveOddsFor, type LiveOdds } from "@/lib/bet/liveOdds";
import { currentActor } from "@/lib/session";
import { PlatformError } from "@/lib/platform/engine";
import type { ActionResult } from "@/lib/domain";

async function runBet<T>(fn: (actor: { userId: string }) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  const actor = await currentActor();
  if (!actor) return { ok: false, error: "Sign in to bet with virtual points." };
  try {
    return await fn(actor);
  } catch (e) {
    if (e instanceof PlatformError) return { ok: false, error: e.message };
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") return { ok: false, error: "That already exists — please refresh." };
      if (e.code === "P2025") return { ok: false, error: "That record no longer exists — please refresh." };
      return { ok: false, error: `Database error ${e.code}: ${e.message.split("\n")[0]}` };
    }
    if (e instanceof Prisma.PrismaClientValidationError)
      return { ok: false, error: `Invalid data: ${e.message.split("\n").filter(Boolean)[0]}` };
    console.error("Bet action failure:", e);
    const msg = e instanceof Error ? e.message.split("\n")[0] : String(e);
    return { ok: false, error: msg.length > 220 ? `${msg.slice(0, 220)}…` : msg };
  }
}

export async function placeBetAction(input: PlaceBetInput) {
  return runBet((a) => placeBet(a, input));
}

export async function placeAccaAction(input: { legs: AccaLeg[]; stake: number }) {
  return runBet((a) => placeAcca(a, input));
}

export async function claimDailyAction() {
  return runBet((a) => claimDaily(a));
}

/**
 * Odds snapshot for display only — /live cards and the Arena sidebar.
 * Betting closes at kick-off, so this never touches a wallet.
 */
export async function getLiveOddsAction(matchIds: string[]): Promise<
  { ok: true; data: LiveOdds[] } | { ok: false; error: string }
> {
  try {
    const data = await liveOddsFor(matchIds);
    return { ok: true, data };
  } catch (e) {
    console.error("getLiveOddsAction failed:", e);
    const msg = e instanceof Error ? e.message.split("\n")[0] : String(e);
    return { ok: false, error: msg.length > 220 ? `${msg.slice(0, 220)}…` : msg };
  }
}
