"use server";

import { exportTeamStats, exportMatchStats, exportCompetitionStandings } from "@/lib/exports/csv";
import type { ActionResult } from "@/lib/domain";

export async function exportTeamCsvAction(teamId: string): Promise<ActionResult<string>> {
  try {
    const csv = await exportTeamStats(teamId);
    if (!csv) return { ok: false, error: "Team not found." };
    return { ok: true, data: csv };
  } catch (e) {
    console.error("exportTeamCsvAction failed", e);
    return { ok: false, error: "Could not export team stats." };
  }
}

export async function exportMatchCsvAction(code: string): Promise<ActionResult<string>> {
  try {
    const csv = await exportMatchStats(code);
    if (!csv) return { ok: false, error: "Match not found." };
    return { ok: true, data: csv };
  } catch (e) {
    console.error("exportMatchCsvAction failed", e);
    return { ok: false, error: "Could not export match report." };
  }
}

export async function exportCompetitionCsvAction(compId: string): Promise<ActionResult<string>> {
  try {
    const csv = await exportCompetitionStandings(compId);
    if (!csv) return { ok: false, error: "Competition not found." };
    return { ok: true, data: csv };
  } catch (e) {
    console.error("exportCompetitionCsvAction failed", e);
    return { ok: false, error: "Could not export standings." };
  }
}
