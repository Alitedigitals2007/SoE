"use server";

import { Prisma } from "@prisma/client";
import {
  addCompetitionTeam,
  addTeamMember,
  assignReferee,
  createCompetition,
  createTeam,
  eligiblePlayersForCompetition,
  fantasyBoard,
  generateCupRound,
  generateLeagueFixtures,
  getOrCreateEntry,
  leagueStandings,
  MAX_FANTASY_PICKS,
  PlatformError,
  playerStats,
  removeTeamMember,
  setFantasyPicks,
  teamStats,
  type Actor,
} from "@/lib/platform/engine";
import { currentActor } from "@/lib/session";
import type { ActionResult } from "@/lib/domain";

async function runEngine<T>(fn: (actor: Actor) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  const actor = await currentActor();
  if (!actor) return { ok: false, error: "Sign in to continue." };
  try {
    return await fn(actor);
  } catch (e) {
    if (e instanceof PlatformError) return { ok: false, error: e.message };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return { ok: false, error: "That already exists — please refresh." };
    console.error("Platform action failure:", e);
    return { ok: false, error: "Something went wrong, please try again." };
  }
}

/* ---------------------------------- teams ---------------------------------- */

export async function createTeamAction(input: { name: string; code: string }) {
  return runEngine((a) => createTeam(a, input));
}

export async function addTeamMemberAction(input: { teamId: string; userId: string; number: number }) {
  return runEngine((a) => addTeamMember(a, input));
}

export async function removeTeamMemberAction(input: { teamId: string; userId: string }) {
  return runEngine((a) => removeTeamMember(a, input));
}

/* ------------------------------- competitions ------------------------------ */

export async function createCompetitionAction(input: {
  name: string;
  type: "LEAGUE" | "CUP";
  season: string;
  teamIds: string[];
}) {
  return runEngine((a) => createCompetition(a, input));
}

export async function addCompetitionTeamAction(input: { competitionId: string; teamId: string }) {
  return runEngine((a) => addCompetitionTeam(a, input));
}

export async function generateLeagueFixturesAction(input: { competitionId: string }) {
  return runEngine((a) => generateLeagueFixtures(a, input));
}

export async function generateCupRoundAction(input: { competitionId: string }) {
  return runEngine((a) => generateCupRound(a, input));
}

export async function assignRefereeAction(input: { matchId: string; refereeId: string }) {
  return runEngine((a) => assignReferee(a, input));
}

/* --------------------------------- fantasy --------------------------------- */

export async function getOrCreateEntryAction(competitionId: string) {
  return runEngine((a) => getOrCreateEntry(a, { competitionId }));
}

export async function setFantasyPicksAction(input: { competitionId: string; playerIds: string[] }) {
  return runEngine((a) => setFantasyPicks(a, input));
}

/* ------------------------------ read helpers ------------------------------- */

export async function eligiblePlayersAction(competitionId: string) {
  try {
    const data = await eligiblePlayersForCompetition(competitionId);
    if (!data) return { ok: false as const, error: "Competition not found." };
    return { ok: true as const, data: { players: data.players, maxPicks: MAX_FANTASY_PICKS } };
  } catch (e) {
    console.error(e);
    return { ok: false as const, error: "Could not load eligible players." };
  }
}

export async function standingsAction(competitionId: string) {
  try {
    const rows = await leagueStandings(competitionId);
    return { ok: true as const, data: rows };
  } catch (e) {
    console.error(e);
    return { ok: false as const, error: "Could not load standings." };
  }
}

export async function playerStatsAction(userId: string) {
  try {
    const data = await playerStats(userId);
    if (!data) return { ok: false as const, error: "Player not found." };
    return { ok: true as const, data };
  } catch (e) {
    console.error(e);
    return { ok: false as const, error: "Could not load player stats." };
  }
}

export async function teamStatsAction(teamId: string) {
  try {
    const data = await teamStats(teamId);
    if (!data) return { ok: false as const, error: "Team not found." };
    return { ok: true as const, data };
  } catch (e) {
    console.error(e);
    return { ok: false as const, error: "Could not load team stats." };
  }
}

export async function fantasyBoardAction(competitionId: string) {
  try {
    const board = await fantasyBoard(competitionId);
    return { ok: true as const, data: board };
  } catch (e) {
    console.error(e);
    return { ok: false as const, error: "Could not load the leaderboard." };
  }
}
