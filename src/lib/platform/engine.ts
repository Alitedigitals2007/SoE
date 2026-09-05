import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateMatchCode } from "@/lib/matchCode";
import type { ErrResult, Role, TeamSide } from "@/lib/domain";

export type Actor = { userId: string; role: Role };

const ok = <T>(data: T): { ok: true; data: T } => ({ ok: true, data });
const err = (error: string): ErrResult => ({ ok: false, error });

export class PlatformError extends Error {}

async function requireAdmin(actor: Actor): Promise<ErrResult | null> {
  if (actor.role !== "ADMIN") return err("Only an admin can do that.");
  return null;
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "team"
  );
}

async function createMatchCode(tx?: Prisma.TransactionClient): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = generateMatchCode();
    const client = tx ?? prisma;
    const exists = await client.match.findUnique({ where: { code }, select: { id: true } });
    if (!exists) return code;
  }
  throw new PlatformError("Could not allocate a match code, please retry.");
}

/* --------------------------------- Teams ----------------------------------- */

export async function createTeam(actor: Actor, input: { name: string; code: string }) {
  const blocked = await requireAdmin(actor);
  if (blocked) return blocked;
  const name = input.name.trim();
  const code = input.code.trim().toUpperCase().slice(0, 3);
  if (!name || !code) return err("Team name and a 2–3 letter code are required.");
  try {
    const team = await prisma.team.create({ data: { name, slug: slugify(name), code } });
    return ok({ team });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return err("A team with that name already exists.");
    throw e;
  }
}

export async function addTeamMember(actor: Actor, input: { teamId: string; userId: string; number: number }) {
  const blocked = await requireAdmin(actor);
  if (blocked) return blocked;
  const number = Math.floor(input.number);
  if (number < 1 || number > 8) return err("Squad numbers run from 1 to 8.");
  const team = await prisma.team.findUnique({ where: { id: input.teamId }, include: { members: true } });
  if (!team) return err("Team not found.");
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user || user.role !== "PLAYER") return err("Pick a player account.");
  if (team.members.some((m) => m.userId === input.userId)) return err("That player is already in the team.");
  if (team.members.some((m) => m.number === number)) return err(`Number ${number} is already taken.`);
  try {
    await prisma.teamPlayer.create({ data: { teamId: team.id, userId: input.userId, number } });
    return ok(undefined);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return err("That player or number is already taken.");
    throw e;
  }
}

export async function removeTeamMember(actor: Actor, input: { teamId: string; userId: string }) {
  const blocked = await requireAdmin(actor);
  if (blocked) return blocked;
  const tp = await prisma.teamPlayer.findUnique({
    where: { teamId_userId: { teamId: input.teamId, userId: input.userId } },
  });
  if (!tp) return err("That player is not in this team.");
  await prisma.teamPlayer.delete({ where: { id: tp.id } });
  return ok(undefined);
}

export async function setTeamImage(actor: Actor, input: { teamId: string; imageUrl: string | null }) {
  const blocked = await requireAdmin(actor);
  if (blocked) return blocked;
  const url = input.imageUrl?.trim() || null;
  if (url && !/^https?:\/\/.+\..+/.test(url)) return err("Enter a full image URL (https://…).");
  await prisma.team.update({ where: { id: input.teamId }, data: { imageUrl: url } });
  return ok(undefined);
}

export async function setTeamCaptain(actor: Actor, input: { teamId: string; userId: string | null }) {
  const blocked = await requireAdmin(actor);
  if (blocked) return blocked;
  const team = await prisma.team.findUnique({ where: { id: input.teamId }, include: { members: true } });
  if (!team) return err("Team not found.");
  if (input.userId && !team.members.some((m) => m.userId === input.userId))
    return err("The captain must be in this team's squad.");
  await prisma.$transaction([
    prisma.teamPlayer.updateMany({ where: { teamId: team.id }, data: { isCaptain: false } }),
    ...(input.userId
      ? [prisma.teamPlayer.updateMany({ where: { teamId: team.id, userId: input.userId }, data: { isCaptain: true } })]
      : []),
  ]);
  return ok(undefined);
}

/* ------------------------------ Competitions ------------------------------- */

export type CompetitionType = "LEAGUE" | "CUP" | "LEAGUE_CUP" | "CUSTOM";

export async function setCompetitionStatus(
  actor: Actor,
  input: { competitionId: string; status: "ACTIVE" | "FINISHED" },
) {
  const blocked = await requireAdmin(actor);
  if (blocked) return blocked;
  await prisma.competition.update({ where: { id: input.competitionId }, data: { status: input.status } });
  return ok(undefined);
}

export async function createCompetition(
  actor: Actor,
  input: {
    name: string;
    type: CompetitionType;
    season: string;
    teamIds: string[];
    groupsCount?: number;
    teamsPerGroup?: number;
    topAdvancing?: number;
    roundsCount?: number;
    countdownSecs?: number;
  },
) {
  const blocked = await requireAdmin(actor);
  if (blocked) return blocked;
  const name = input.name.trim();
  const season = input.season.trim();
  if (!name || !season) return err("Competition name and season are required.");
  const teamIds = [...new Set(input.teamIds)];
  if (teamIds.length < 2) return err("A competition needs at least 2 teams.");
  if (input.type === "CUP" && teamIds.length % 2 !== 0)
    return err("Knockout cups need an even number of teams (2, 4, 8, 16…).");
  if (input.type === "LEAGUE_CUP") {
    if (!input.groupsCount || !input.teamsPerGroup || !input.topAdvancing)
      return err("Group competitions need groups count, teams per group, and top N advancing.");
    if (input.groupsCount * input.teamsPerGroup > teamIds.length)
      return err("Not enough teams for the configured group layout.");
  }
  const teams = await prisma.team.findMany({ where: { id: { in: teamIds } }, select: { id: true } });
  if (teams.length !== teamIds.length) return err("One of the chosen teams does not exist.");

  const base = slugify(name);
  const slug = `${base}-${season.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;

  try {
    const competition = await prisma.$transaction(async (tx) => {
      const comp = await tx.competition.create({
        data: {
          name,
          slug,
          type: input.type,
          season,
          status: "DRAFT",
          groupsCount: input.groupsCount ?? null,
          teamsPerGroup: input.teamsPerGroup ?? null,
          topAdvancing: input.topAdvancing ?? null,
          roundsCount: input.roundsCount ?? null,
          countdownSecs: input.countdownSecs ?? null,
        },
      });
      for (const [i, teamId] of teamIds.entries()) {
        await tx.competitionTeam.create({
          data: { competitionId: comp.id, teamId, seed: i + 1 },
        });
      }
      return comp;
    });
    return ok({ competitionId: competition.id, slug: competition.slug });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return err("A competition with that name and season already exists.");
    throw e;
  }
}

export async function addCompetitionTeam(actor: Actor, input: { competitionId: string; teamId: string }) {
  const blocked = await requireAdmin(actor);
  if (blocked) return blocked;
  const comp = await prisma.competition.findUnique({
    where: { id: input.competitionId },
    include: { teams: true, matches: { select: { id: true } } },
  });
  if (!comp) return err("Competition not found.");
  if (comp.matches.length > 0) return err("Teams cannot be added once fixtures exist.");
  const count = comp.teams.length + 1;
  if (comp.type === "CUP" && count % 2 !== 0) return err("Knockout cups need an even number of teams.");
  try {
    await prisma.competitionTeam.create({
      data: { competitionId: comp.id, teamId: input.teamId, seed: count },
    });
    return ok(undefined);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return err("That team is already in the competition.");
    throw e;
  }
}

/* --------------------------- fixture generation ----------------------------- */

async function syncRosterFromTeams(tx: Prisma.TransactionClient, matchId: string, homeTeamId: string, awayTeamId: string) {
  const members = await tx.teamPlayer.findMany({
    where: { teamId: { in: [homeTeamId, awayTeamId] } },
    orderBy: [{ teamId: "asc" }, { number: "asc" }],
  });
  for (const m of members) {
    const side: TeamSide = m.teamId === homeTeamId ? "HOME" : "AWAY";
    const existing = await tx.matchPlayer.findUnique({
      where: { matchId_userId: { matchId, userId: m.userId } },
    });
    if (existing) continue;
    const occupied = await tx.matchPlayer.findUnique({
      where: { matchId_team_number: { matchId, team: side, number: m.number } },
    });
    const number = occupied ? (await tx.matchPlayer.count({ where: { matchId, team: side } })) + 1 : m.number;
    await tx.matchPlayer.create({
      data: { matchId, userId: m.userId, team: side, number: Math.min(number, 8) },
    });
  }
}

async function createFixture(tx: Prisma.TransactionClient, opts: { competitionId: string; home: { id: string; name: string }; away: { id: string; name: string }; cupRound?: number; countdownSeconds?: number }) {
  const code = await createMatchCode(tx);
  const match = await tx.match.create({
    data: {
      code,
      homeName: opts.home.name,
      awayName: opts.away.name,
      homeTeamId: opts.home.id,
      awayTeamId: opts.away.id,
      competitionId: opts.competitionId,
      cupRound: opts.cupRound ?? null,
      refereeId: null,
      status: "DRAFT",
      countdownSeconds: opts.countdownSeconds ?? 15,
    },
  });
  await syncRosterFromTeams(tx, match.id, opts.home.id, opts.away.id);
  return match;
}

export async function generateLeagueFixtures(actor: Actor, input: { competitionId: string }) {
  const blocked = await requireAdmin(actor);
  if (blocked) return blocked;
  const comp = await prisma.competition.findUnique({
    where: { id: input.competitionId },
    include: { teams: { include: { team: true }, orderBy: { seed: "asc" } }, matches: { select: { id: true } } },
  });
  if (!comp) return err("Competition not found.");
  if (comp.type !== "LEAGUE" && comp.type !== "LEAGUE_CUP") return err("Only leagues get a round-robin schedule.");
  if (comp.matches.length > 0) return err("Fixtures already exist for this league.");

  const teams = comp.teams.map((t) => t.team);
  const n = teams.length;
  const isEven = n % 2 === 0;
  const list = isEven ? [...teams] : [...teams, null as unknown as typeof teams[0]];

  const pairings: { home: number; away: number }[] = [];
  for (let r = 0; r < list.length - 1; r++) {
    for (let i = 0; i < list.length / 2; i++) {
      const a = list[i];
      const b = list[list.length - 1 - i];
      if (!a || !b) continue;
      // alternate home/away each round for fairness
      const home = r % 2 === 0 ? a : b;
      const away = r % 2 === 0 ? b : a;
      pairings.push({ home: teams.indexOf(home), away: teams.indexOf(away) });
    }
    list.splice(1, 0, list.pop()!);
  }

  // Respect roundsCount: limit pairings to roundsCount full round-robins
  const roundsCount = comp.roundsCount ?? null;
  let selectedPairings = pairings;
  if (roundsCount && roundsCount > 0) {
    const pairingsPerRound = pairings.length / (n - (isEven ? 1 : 0));
    const totalPairs = Math.floor(pairingsPerRound) * roundsCount;
    selectedPairings = pairings.slice(0, totalPairs);
  }

  const cd = comp.countdownSecs ?? 15;

  await prisma.competition.update({ where: { id: comp.id }, data: { status: "ACTIVE" } });
  for (const p of selectedPairings) {
    const home = teams[p.home];
    const away = teams[p.away];
    await prisma.$transaction(async (tx) => {
      await createFixture(tx, { competitionId: comp.id, home: { id: home.id, name: home.name }, away: { id: away.id, name: away.name }, countdownSeconds: cd });
    });
  }
  return ok({ count: selectedPairings.length });
}

export async function generateCupRound(actor: Actor, input: { competitionId: string }) {
  const blocked = await requireAdmin(actor);
  if (blocked) return blocked;
  const comp = await prisma.competition.findUnique({
    where: { id: input.competitionId },
    include: {
      teams: { include: { team: true }, orderBy: { seed: "asc" } },
      matches: { orderBy: { createdAt: "asc" }, include: { penaltyShootout: true } },
    },
  });
  if (!comp) return err("Competition not found.");
  if (comp.type !== "CUP" && comp.type !== "LEAGUE_CUP") return err("Only knockout cups get rounds.");

  const cd = comp.countdownSecs ?? 15;

  if (comp.matches.length === 0) {
    // Round 1 from seeds
    const ordered = comp.teams.map((t) => t.team);
    if (ordered.length < 2 || ordered.length % 2 !== 0)
      return err("A knockout needs an even number of seeded teams.");
    const pairs: [typeof ordered[0], typeof ordered[0]][] = [];
    for (let i = 0; i < ordered.length; i += 2) pairs.push([ordered[i], ordered[i + 1]]);
    await prisma.competition.update({ where: { id: comp.id }, data: { status: "ACTIVE" } });
    for (const [a, b] of pairs) {
      await prisma.$transaction(async (tx) => {
        await createFixture(tx, { competitionId: comp.id, home: { id: a.id, name: a.name }, away: { id: b.id, name: b.name }, cupRound: 1, countdownSeconds: cd });
      });
    }
    return ok({ count: pairs.length });
  }

  // Advance from the finished matches of the latest round
  const maxRound = Math.max(...comp.matches.map((m) => m.cupRound ?? 0));
  const roundMatches = comp.matches.filter((m) => m.cupRound === maxRound);
  if (roundMatches.length === 0) return err("No fixtures to advance from.");
  if (!roundMatches.every((m) => m.status === "FINISHED"))
    return err("Finish every match in the current round before generating the next.");

  const winners: { id: string; name: string }[] = [];
  for (const m of roundMatches) {
    if (m.homeScore === m.awayScore) {
      if (!m.penaltyShootout || m.penaltyShootout.status !== "COMPLETE" || !m.penaltyShootout.winner)
        return err(`Round ${maxRound} has a drawn match (${m.homeName} v ${m.awayName}). Use penalties to decide the winner.`);
      const penWinner = m.penaltyShootout.winner === "HOME"
        ? { id: m.homeTeamId!, name: m.homeName }
        : { id: m.awayTeamId!, name: m.awayName };
      winners.push(penWinner);
    } else {
      winners.push(m.homeScore > m.awayScore ? { id: m.homeTeamId!, name: m.homeName } : { id: m.awayTeamId!, name: m.awayName });
    }
  }
  if (winners.length < 2) return err("The cup is over — a champion has been decided.");

  const nextRound = maxRound + 1;
  const count = Math.floor(winners.length / 2);
  for (let i = 0; i < count; i++) {
    await prisma.$transaction(async (tx) => {
      await createFixture(tx, {
        competitionId: comp.id,
        home: winners[i * 2],
        away: winners[i * 2 + 1],
        cupRound: nextRound,
        countdownSeconds: cd,
      });
    });
  }
  return ok({ count });
}

/* ------------------------------ group + cup ------------------------------ */

export async function generateGroupFixtures(
  actor: Actor,
  input: { competitionId: string },
) {
  const blocked = await requireAdmin(actor);
  if (blocked) return blocked;

  const comp = await prisma.competition.findUnique({
    where: { id: input.competitionId },
    include: {
      teams: { include: { team: true }, orderBy: { seed: "asc" } },
      matches: { select: { id: true } },
    },
  });
  if (!comp) return err("Competition not found.");
  if (comp.type !== "LEAGUE_CUP") return err("This competition is not a League + Cup format.");
  if (comp.matches.length > 0) return err("Fixtures already exist.");
  if (!comp.groupsCount || !comp.teamsPerGroup || !comp.topAdvancing)
    return err("Group configuration is missing.");

  const groupsCount = comp.groupsCount;
  const teamsPerGroup = comp.teamsPerGroup;
  const topAdvancing = comp.topAdvancing;
  const cd = comp.countdownSecs ?? 15;
  const allTeams = comp.teams.map((ct) => ct.team);

  if (groupsCount * teamsPerGroup > allTeams.length)
    return err("Not enough teams for the configured groups.");

  // Split teams into groups (round-robin within each group)
  const shuffled = [...allTeams];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const groups: (typeof allTeams)[] = [];
  for (let g = 0; g < groupsCount; g++) {
    groups.push(shuffled.slice(g * teamsPerGroup, (g + 1) * teamsPerGroup));
  }

  await prisma.competition.update({ where: { id: comp.id }, data: { status: "ACTIVE" } });

  // Generate round-robin fixtures within each group
  for (const groupTeams of groups) {
    const n = groupTeams.length;
    const isEven = n % 2 === 0;
    const list = isEven ? [...groupTeams] : [...groupTeams, null as unknown as typeof groupTeams[0]];

    const pairings: { home: number; away: number }[] = [];
    for (let r = 0; r < list.length - 1; r++) {
      for (let i = 0; i < list.length / 2; i++) {
        const a = list[i];
        const b = list[list.length - 1 - i];
        if (!a || !b) continue;
        const home = r % 2 === 0 ? a : b;
        const away = r % 2 === 0 ? b : a;
        pairings.push({ home: groupTeams.indexOf(home), away: groupTeams.indexOf(away) });
      }
      list.splice(1, 0, list.pop()!);
    }

    for (const p of pairings) {
      const home = groupTeams[p.home];
      const away = groupTeams[p.away];
      await prisma.$transaction(async (tx) => {
        await createFixture(tx, {
          competitionId: comp.id,
          home: { id: home.id, name: home.name },
          away: { id: away.id, name: away.name },
          countdownSeconds: cd,
        });
      });
    }
  }

  // Calculate total knockout rounds needed
  const totalKnockoutTeams = groupsCount * topAdvancing;
  const knockoutRounds = Math.ceil(Math.log2(totalKnockoutTeams));

  return ok({
    count: groupsCount * Math.floor((teamsPerGroup * (teamsPerGroup - 1)) / 2),
    groups: groupsCount,
    knockoutRounds,
  });
}

export async function assignReferee(actor: Actor, input: { matchId: string; refereeId: string }) {
  const blocked = await requireAdmin(actor);
  if (blocked) return blocked;
  const referee = await prisma.user.findUnique({ where: { id: input.refereeId } });
  if (!referee || referee.role !== "REFEREE") return err("The referee must be a referee account.");
  await prisma.match.update({ where: { id: input.matchId }, data: { refereeId: referee.id } });
  return ok(undefined);
}

/* --------------------------------- Fantasy --------------------------------- */

export const GOAL_POINTS = 10;

export async function eligiblePlayersForCompetition(competitionId: string) {
  const comp = await prisma.competition.findUnique({
    where: { id: competitionId },
    include: { teams: { include: { team: { include: { members: { include: { user: { select: { id: true, name: true } } } } } } } } },
  });
  if (!comp) return null;
  const map = new Map<string, { id: string; name: string; teams: string[] }>();
  for (const ct of comp.teams) {
    for (const m of ct.team.members) {
      const cur = map.get(m.userId);
      if (cur) cur.teams.push(ct.team.name);
      else map.set(m.userId, { id: m.userId, name: m.user.name, teams: [ct.team.name] });
    }
  }
  return { competition: comp, players: [...map.values()] };
}

export const MAX_FANTASY_PICKS = 5;

export async function getOrCreateEntry(actor: Actor, input: { competitionId: string }) {
  const comp = await prisma.competition.findUnique({ where: { id: input.competitionId }, select: { id: true } });
  if (!comp) return err("Competition not found.");
  const existing = await prisma.fantasyEntry.findUnique({
    where: { competitionId_userId: { competitionId: input.competitionId, userId: actor.userId } },
  });
  if (existing) return ok({ entry: existing });
  const user = await prisma.user.findUnique({ where: { id: actor.userId }, select: { name: true } });
  const entry = await prisma.fantasyEntry.create({
    data: {
      competitionId: input.competitionId,
      userId: actor.userId,
      name: `${user?.name ?? "Player"}'s XI`,
    },
  });
  return ok({ entry });
}

export async function setFantasyPicks(actor: Actor, input: { competitionId: string; playerIds: string[] }) {
  const comp = await prisma.competition.findUnique({
    where: { id: input.competitionId },
    include: { fantasyEntries: { where: { userId: actor.userId }, select: { id: true } } },
  });
  if (!comp) return err("Competition not found.");
  const entry = comp.fantasyEntries[0];
  if (!entry) return err("Create your entry first.");
  if (comp.status === "FINISHED") return err("The competition is over — no more picks.");

  const ids = [...new Set(input.playerIds)];
  if (ids.length > MAX_FANTASY_PICKS) return err(`You can pick up to ${MAX_FANTASY_PICKS} players.`);

  const eligible = await eligiblePlayersForCompetition(input.competitionId);
  if (!eligible) return err("Competition not found.");
  const allowed = new Set(eligible.players.map((p) => p.id));
  for (const id of ids) if (!allowed.has(id)) return err("A picked player is not part of this competition.");

  await prisma.$transaction(async (tx) => {
    await tx.fantasyPick.deleteMany({ where: { entryId: entry.id } });
    for (const playerUserId of ids) {
      await tx.fantasyPick.create({
        data: { entryId: entry.id, competitionId: input.competitionId, playerUserId },
      });
    }
  });
  return ok(undefined);
}

/* ------------------------------- standings -------------------------------- */

export async function leagueStandings(competitionId: string) {
  const teams = await prisma.competitionTeam.findMany({
    where: { competitionId },
    include: { team: { select: { id: true, name: true, slug: true, code: true } } },
    orderBy: { seed: "asc" },
  });
  const matches = await prisma.match.findMany({
    where: { competitionId, status: "FINISHED", homeTeamId: { not: null }, awayTeamId: { not: null } },
    select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true },
  });

  type Row = { id: string; name: string; slug: string; code: string; p: number; w: number; d: number; l: number; gf: number; ga: number; pts: number };
  const rows = new Map<string, Row>();
  for (const t of teams) {
    rows.set(t.team.id, { id: t.team.id, name: t.team.name, slug: t.team.slug, code: t.team.code, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });
  }
  for (const m of matches) {
    const h = rows.get(m.homeTeamId!);
    const a = rows.get(m.awayTeamId!);
    if (!h || !a) continue;
    h.p++; a.p++;
    h.gf += m.homeScore; h.ga += m.awayScore;
    a.gf += m.awayScore; a.ga += m.homeScore;
    if (m.homeScore > m.awayScore) { h.w++; h.pts += 3; a.l++; }
    else if (m.homeScore < m.awayScore) { a.w++; a.pts += 3; h.l++; }
    else { h.d++; a.d++; h.pts++; a.pts++; }
  }
  return [...rows.values()].sort((x, y) => y.pts - x.pts || y.gf - y.ga - (x.gf - x.ga) || y.gf - x.gf || x.name.localeCompare(y.name));
}

/* ----------------------------- public stat cards --------------------------- */

export async function playerStats(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { teams: { include: { team: { select: { name: true, slug: true, code: true } } } } },
  });
  if (!user) return null;

  const [goals, slots] = await Promise.all([
    prisma.round.findMany({
      where: { decision: "GOAL", goalSubmission: { player: { userId } }, match: { status: "FINISHED" } },
      select: { id: true },
    }),
    prisma.matchPlayer.findMany({
      where: { userId, match: { status: "FINISHED" } },
      include: { match: { select: { homeName: true, awayName: true, homeScore: true, awayScore: true, homeTeamId: true, awayTeamId: true, code: true, status: true } } },
      orderBy: { match: { finishedAt: "desc" } },
      take: 12,
    }),
  ]);

  let wins = 0;
  const matches = slots.map((s) => {
    const m = s.match;
    const myScore = s.team === "HOME" ? m.homeScore : m.awayScore;
    const oppScore = s.team === "HOME" ? m.awayScore : m.homeScore;
    if (myScore > oppScore) wins++;
    return {
      code: m.code,
      opponent: s.team === "HOME" ? m.awayName : m.homeName,
      result: myScore > oppScore ? ("W" as const) : myScore < oppScore ? ("L" as const) : ("D" as const),
      myScore,
      oppScore,
    };
  });

  return {
    id: user.id,
    name: user.name,
    role: user.role,
    goals: goals.length,
    matches: slots.length,
    wins,
    teams: user.teams.map((t) => ({ name: t.team.name, slug: t.team.slug, code: t.team.code })),
    recent: matches,
  };
}

export async function teamStats(teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { members: { include: { user: { select: { id: true, name: true } } }, orderBy: { number: "asc" } } },
  });
  if (!team) return null;
  const finished = await prisma.match.findMany({
    where: { status: "FINISHED", OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
    include: { competition: { select: { name: true, slug: true } }, homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
    orderBy: { finishedAt: "desc" },
  });

  let p = 0, w = 0, d = 0, l = 0, gf = 0, ga = 0;
  const recent = finished.slice(0, 12).map((m) => {
    const home = m.homeTeamId === teamId;
    const myScore = home ? m.homeScore : m.awayScore;
    const oppScore = home ? m.awayScore : m.homeScore;
    if (myScore > oppScore) return { code: m.code, opponent: home ? m.awayTeam!.name : m.homeTeam!.name, result: "W" as const, myScore, oppScore, comp: m.competition?.name ?? null, compSlug: m.competition?.slug ?? null };
    if (myScore < oppScore) return { code: m.code, opponent: home ? m.awayTeam!.name : m.homeTeam!.name, result: "L" as const, myScore, oppScore, comp: m.competition?.name ?? null, compSlug: m.competition?.slug ?? null };
    return { code: m.code, opponent: home ? m.awayTeam!.name : m.homeTeam!.name, result: "D" as const, myScore, oppScore, comp: m.competition?.name ?? null, compSlug: m.competition?.slug ?? null };
  });
  for (const m of finished) {
    const home = m.homeTeamId === teamId;
    const myScore = home ? m.homeScore : m.awayScore;
    const oppScore = home ? m.awayScore : m.homeScore;
    p++; gf += myScore; ga += oppScore;
    if (myScore > oppScore) w++;
    else if (myScore < oppScore) l++;
    else d++;
  }

  const captain = team.members.find((m) => m.isCaptain);

  return {
    id: team.id,
    name: team.name,
    slug: team.slug,
    code: team.code,
    imageUrl: team.imageUrl,
    p,
    w,
    d,
    l,
    gf,
    ga,
    recent,
    captain: captain ? { id: captain.user.id, name: captain.user.name, number: captain.number } : null,
    members: team.members.map((m) => ({ id: m.user.id, name: m.user.name, number: m.number, isCaptain: m.isCaptain })),
  };
}

export async function fantasyBoard(competitionId: string) {
  return prisma.fantasyEntry.findMany({
    where: { competitionId },
    include: { user: { select: { id: true, name: true } }, _count: { select: { picks: true } } },
    orderBy: [{ points: "desc" }, { updatedAt: "asc" }],
  });
}
