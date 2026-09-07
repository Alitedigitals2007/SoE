"use server";

import { prisma } from "@/lib/prisma";
import { currentActor } from "@/lib/session";
import { importTeamPlayers } from "@/lib/imports/teamImport";
import type { ActionResult } from "@/lib/domain";

export async function importTeamCsvAction(
  teamId: string,
  csv: string,
): Promise<ActionResult<{ imported: number; created: { name: string; email: string; password: string }[]; issues: { row: number; message: string }[] }>> {
  const actor = await currentActor();
  if (!actor) return { ok: false, error: "Sign in to continue." };
  if (actor.role !== "ADMIN") return { ok: false, error: "Only an admin can import players." };
  return importTeamPlayers(teamId, csv);
}
