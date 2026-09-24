"use server";

import { Prisma } from "@prisma/client";
import { placeBet, type PlaceBetInput } from "@/lib/bet/engine";
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
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return { ok: false, error: "That already exists — please refresh." };
    console.error("Bet action failure:", e);
    return { ok: false, error: "Something went wrong, please try again." };
  }
}

export async function placeBetAction(input: PlaceBetInput) {
  return runBet((a) => placeBet(a, input));
}
