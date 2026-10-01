"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  addCompetitionTeam,
  addTeamMember,
  adminAdjustWallet,
  assignReferee,
  createCompetition,
  createTeam,
  eligiblePlayersForCompetition,
  fantasyBoard,
  generateCupRound,
  generateGroupFixtures,
  generateLeagueFixtures,
  getOrCreateEntry,
  leagueStandings,
  MAX_FANTASY_PICKS,
  PlatformError,
  playerStats,
  redrawLeagueFixtures,
  removeCompetitionTeam,
  removeTeamMember,
  scheduleLeagueWave,
  setCompetitionStatus,
  setCupFormat,
  setFantasyPicks,
  setTeamCaptain,
  setTeamImage,
  teamStats,
  transferTeamMember,
  type Actor,
  type StandingRow,
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

export async function setTeamImageAction(input: { teamId: string; imageUrl: string | null }) {
  return runEngine((a) => setTeamImage(a, input));
}

export async function setTeamCaptainAction(input: { teamId: string; userId: string | null }) {
  return runEngine((a) => setTeamCaptain(a, input));
}

export async function transferTeamMemberAction(input: { teamId: string; userId: string; toTeamId: string }) {
  return runEngine((a) => transferTeamMember(a, input));
}

export async function setCompetitionStatusAction(input: {
  competitionId: string;
  status: "ACTIVE" | "FINISHED";
}) {
  return runEngine((a) => setCompetitionStatus(a, input));
}

export async function scheduleLeagueWaveAction(input: {
  competitionId: string;
  count: number;
  firstKickAt?: string | null;
}) {
  return runEngine((a) =>
    scheduleLeagueWave(a, { competitionId: input.competitionId, count: input.count, firstKickAt: input.firstKickAt ? new Date(input.firstKickAt) : undefined }),
  );
}

/* ------------------------------- competitions ------------------------------ */

export async function createCompetitionAction(input: {
  name: string;
  type: "LEAGUE" | "CUP" | "LEAGUE_CUP" | "CUSTOM";
  season: string;
  teamIds: string[];
  groupsCount?: number;
  teamsPerGroup?: number;
  topAdvancing?: number;
  roundsCount?: number;
  countdownSecs?: number;
}) {
  return runEngine((a) => createCompetition(a, input));
}

export async function addCompetitionTeamAction(input: { competitionId: string; teamId: string }) {
  return runEngine((a) => addCompetitionTeam(a, input));
}

export async function removeCompetitionTeamAction(input: { competitionId: string; teamId: string }) {
  return runEngine((a) => removeCompetitionTeam(a, input));
}

export async function generateLeagueFixturesAction(input: { competitionId: string }) {
  return runEngine((a) => generateLeagueFixtures(a, input));
}

export async function redrawLeagueFixturesAction(input: { competitionId: string }) {
  return runEngine((a) => redrawLeagueFixtures(a, input));
}

export async function generateCupRoundAction(input: { competitionId: string }) {
  return runEngine((a) => generateCupRound(a, input));
}

/** Change a cup's legs-per-tie or third-place match after creation. */
export async function setCupFormatAction(input: {
  competitionId: string;
  legsPerTie?: number;
  thirdPlace?: boolean;
}) {
  return runEngine((a) => setCupFormat(a, input));
}

export async function generateGroupFixturesAction(input: { competitionId: string }) {
  return runEngine((a) => generateGroupFixtures(a, input));
}

/**
 * The competitions an admin can lift a team list from — the wizard's
 * "pick from a league's standings" browser.
 */
export async function pickSourceCompetitionsAction(): Promise<
  ActionResult<{ id: string; name: string; season: string; type: string; teamCount: number }[]>
> {
  const actor = await currentActor();
  if (!actor) return { ok: false, error: "Sign in to continue." };
  if (actor.role !== "ADMIN") return { ok: false, error: "Only admins can do that." };
  try {
    const comps = await prisma.competition.findMany({
      orderBy: [{ season: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        season: true,
        type: true,
        status: true,
        _count: { select: { teams: true } },
      },
    });
    return {
      ok: true,
      data: comps.map((c) => ({
        id: c.id,
        name: c.name,
        season: c.season,
        type: c.type,
        status: c.status,
        teamCount: c._count.teams,
      })),
    };
  } catch (e) {
    console.error("pickSourceCompetitionsAction failed", e);
    return { ok: false, error: "Could not list competitions." };
  }
}

/** Standings of an existing competition, in table order, for picking teams. */
export async function competitionStandingsAction(competitionId: string): Promise<ActionResult<StandingRow[]>> {
  const actor = await currentActor();
  if (!actor) return { ok: false, error: "Sign in to continue." };
  if (actor.role !== "ADMIN") return { ok: false, error: "Only admins can do that." };
  try {
    return { ok: true, data: await leagueStandings(competitionId, { live: true }) };
  } catch (e) {
    console.error("competitionStandingsAction failed", e);
    return { ok: false, error: "Could not read that competition's standings." };
  }
}

export async function assignRefereeAction(input: { matchId: string; refereeId: string | null }) {
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
    const rows = await leagueStandings(competitionId, { live: true });
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

/* --------------------------------- wallet ---------------------------------- */

export async function adminAdjustWalletAction(input: { userId: string; amount: number; note?: string }) {
  return runEngine((a) => adminAdjustWallet(a, input));
}
