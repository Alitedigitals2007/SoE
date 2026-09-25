import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PROBS,
  DEFAULT_XG_AWAY,
  DEFAULT_XG_HOME,
  HALF_FULL_CELLS,
  TEAM_TOTAL_LINES,
  TOTAL_LINES,
  doubleChanceProbs,
  drawNoBetProbs,
  expectedGoalsFromWinProb,
  exactScoreProbability,
  halfFullProbs,
  halfResultProbs,
  outcomeProbsFromWinProb,
  overProbability,
  ppgWinProbability,
  price,
  probabilityScoresAtLeastOne,
  scoreMatrix,
  totalGoalsDistribution,
} from "@/lib/bet/pricing";

export type ExactScoreOdd = { home: number; away: number; odds: number };

export type MatchOdds = {
  home: number;
  draw: number;
  away: number;
  /** Exact-score prices for every 0–10 v 0–10 line (121 entries, index = home*11+away). */
  scoreOdds: number[];
  /** "table" = derived from league standings, "default" = standard prices. */
  source: "table" | "default";
};

export type MatchTeams = {
  competitionId: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
};

/** Points-per-game per team, read from one competition's finished league fixtures. */
type LeagueTable = Map<string, number>;

/**
 * The league/group standings behind every market. Read ONCE per competition and
 * shared by all of that competition's matches — cup fixtures (cupRound set) are
 * excluded because knockouts skew the table.
 */
async function leagueTable(competitionId: string): Promise<LeagueTable> {
  const finished = await prisma.match.findMany({
    where: { competitionId, status: "FINISHED", cupRound: null, homeTeamId: { not: null }, awayTeamId: { not: null } },
    select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true },
  });
  const stats = new Map<string, { pts: number; played: number }>();
  const bump = (id: string | null, pts: number) => {
    if (!id) return;
    const s = stats.get(id) ?? { pts: 0, played: 0 };
    s.pts += pts;
    s.played += 1;
    stats.set(id, s);
  };
  for (const m of finished) {
    if (m.homeScore > m.awayScore) {
      bump(m.homeTeamId, 3);
      bump(m.awayTeamId, 0);
    } else if (m.homeScore < m.awayScore) {
      bump(m.homeTeamId, 0);
      bump(m.awayTeamId, 3);
    } else {
      bump(m.homeTeamId, 1);
      bump(m.awayTeamId, 1);
    }
  }
  const table: LeagueTable = new Map();
  for (const [id, s] of stats) {
    if (s.played > 0) table.set(id, s.pts / s.played);
  }
  return table;
}

type Model = {
  pHome: number;
  pDraw: number;
  pAway: number;
  xgHome: number;
  xgAway: number;
  source: MatchOdds["source"];
};

const DEFAULT_MODEL: Model = {
  ...DEFAULT_PROBS,
  xgHome: DEFAULT_XG_HOME,
  xgAway: DEFAULT_XG_AWAY,
  source: "default",
};

/**
 * The one outcome/goals model behind every market. `table` may be passed in
 * (batched page loads) to skip the standings query; otherwise it is read once.
 */
async function matchModel(match: MatchTeams, table?: LeagueTable): Promise<Model> {
  if (match.competitionId && match.homeTeamId && match.awayTeamId) {
    const t = table ?? (await leagueTable(match.competitionId));
    const homePpg = t.get(match.homeTeamId);
    const awayPpg = t.get(match.awayTeamId);
    if (homePpg !== undefined && awayPpg !== undefined) {
      const p = ppgWinProbability(homePpg, awayPpg);
      return {
        ...outcomeProbsFromWinProb(p),
        ...expectedGoalsFromWinProb(p),
        source: "table",
      };
    }
  }
  return { ...DEFAULT_MODEL };
}

/** Win/draw/win probabilities: standings-based when a table exists, standard otherwise. */
export async function outcomeProbs(match: MatchTeams): Promise<{ pHome: number; pDraw: number; pAway: number; source: MatchOdds["source"] }> {
  const { pHome, pDraw, pAway, source } = await matchModel(match);
  return { pHome, pDraw, pAway, source };
}

/** Expected goals for both sides, split by relative strength (≈2.7-goal game). */
export async function expectedGoals(match: MatchTeams): Promise<{ xgHome: number; xgAway: number }> {
  const { xgHome, xgAway } = await matchModel(match);
  return { xgHome, xgAway };
}

/** Auto odds for a match: 1X2 + exact-score matrix (0–10 per side). */
export async function oddsForMatch(match: MatchTeams): Promise<MatchOdds> {
  return (await allOdds(match)).match;
}

/**
 * Auto odds for many matches with ONE standings read per distinct competition
 * (and none at all for friendlies) — keeps page loads to a couple of queries.
 */
export async function oddsForMatches(matches: MatchTeams[]): Promise<AllOdds[]> {
  const comps = [...new Set(matches.map((m) => m.competitionId).filter((c): c is string => !!c))];
  const tables = new Map<string, LeagueTable>();
  await Promise.all(comps.map(async (c) => tables.set(c, await leagueTable(c))));
  return Promise.all(
    matches.map(async (m) => {
      const model = await matchModel(m, m.competitionId ? tables.get(m.competitionId) : undefined);
      return priceAll(model);
    }),
  );
}

/** Odds for a single exact scoreline (0–10 goals per side), e.g. when placing a bet. */
export async function exactScoreOdds(match: MatchTeams, homeGoals: number, awayGoals: number): Promise<number> {
  const { xgHome, xgAway } = await expectedGoals(match);
  return price(exactScoreProbability(xgHome, xgAway, homeGoals, awayGoals));
}

/* ------------------------------- goals markets ----------------------------- */

export type GoalsOdds = {
  btts: { yes: number; no: number };
  /** Classic over/under lines (half-ball, so no pushes). */
  lines: { line: number; over: number; under: number }[];
};

/** Over/under + both-teams-to-score prices from the same expected-goals model. */
export async function goalsOdds(match: MatchTeams): Promise<GoalsOdds> {
  return (await allOdds(match)).goals;
}

/* --------------------------- extra pre-match markets ----------------------- */

/** Double chance — 1X / X2 / 12. */
export async function doubleChanceOdds(match: MatchTeams): Promise<Record<"1X" | "X2" | "12", number>> {
  return (await allOdds(match)).doubleChance;
}

/** Draw-no-bet — a draw refunds the stake, so only the win side is priced. */
export async function drawNoBetOdds(match: MatchTeams): Promise<{ HOME: number; AWAY: number }> {
  return (await allOdds(match)).drawNoBet;
}

/** Half-time result — HOME / DRAW / AWAY at the break. */
export async function halfResultOdds(match: MatchTeams): Promise<{ HOME: number; DRAW: number; AWAY: number }> {
  return (await allOdds(match)).halfResult;
}

/** Half-time / full-time — nine combinations (HH, HD, HA, DH … AA). */
export async function halfFullOdds(match: MatchTeams): Promise<Record<string, number>> {
  return (await allOdds(match)).halfFull;
}

export type TeamTotalsOdds = Record<"HOME" | "AWAY", { line: number; over: number; under: number }[]>;

/** Per-team over/under prices. */
export async function teamTotalsOdds(match: MatchTeams): Promise<TeamTotalsOdds> {
  return (await allOdds(match)).teamTotals;
}

/* ------------------------------ every market at once ------------------------ */

export type AllOdds = {
  match: MatchOdds;
  goals: GoalsOdds;
  doubleChance: Record<"1X" | "X2" | "12", number>;
  drawNoBet: { HOME: number; AWAY: number };
  halfResult: { HOME: number; DRAW: number; AWAY: number };
  halfFull: Record<string, number>;
  teamTotals: TeamTotalsOdds;
};

/** Price every market from one outcome/goals model — no extra DB reads. */
export function priceAll(input: {
  pHome: number;
  pDraw: number;
  pAway: number;
  source: "table" | "default";
  xgHome: number;
  xgAway: number;
}): AllOdds {
  const { pHome, pDraw, pAway, source, xgHome, xgAway } = input;

  const dc = doubleChanceProbs({ pHome, pDraw, pAway });
  const dnb = drawNoBetProbs({ pHome, pAway });
  const hr = halfResultProbs(xgHome, xgAway);
  const hf = halfFullProbs(xgHome, xgAway);

  // Convolve the two Poisson distributions into a total-goals distribution.
  const total = totalGoalsDistribution(xgHome, xgAway, 20);
  const lines = TOTAL_LINES.map((line) => {
    const pOver = total.reduce((acc, p, t) => (t > line ? acc + p : acc), 0);
    return { line, over: price(pOver), under: price(1 - pOver) };
  });
  const pBtts = probabilityScoresAtLeastOne(xgHome) * probabilityScoresAtLeastOne(xgAway);

  const buildTeam = (xg: number) =>
    TEAM_TOTAL_LINES.map((line) => {
      const over = overProbability(xg, line);
      return { line, over: price(over), under: price(1 - over) };
    });

  return {
    match: {
      home: price(pHome),
      draw: price(pDraw),
      away: price(pAway),
      scoreOdds: scoreMatrix(xgHome, xgAway).map(price),
      source,
    },
    goals: { btts: { yes: price(pBtts), no: price(1 - pBtts) }, lines },
    doubleChance: { "1X": price(dc["1X"]), X2: price(dc.X2), "12": price(dc["12"]) },
    drawNoBet: { HOME: price(dnb.HOME), AWAY: price(dnb.AWAY) },
    halfResult: { HOME: price(hr.H), DRAW: price(hr.D), AWAY: price(hr.A) },
    halfFull: Object.fromEntries(HALF_FULL_CELLS.map((cell) => [cell, price(hf[cell])])),
    teamTotals: { HOME: buildTeam(xgHome), AWAY: buildTeam(xgAway) },
  };
}

/** One round-trip (outcome + expected goals) priced into every market. */
export async function allOdds(match: MatchTeams): Promise<AllOdds> {
  return priceAll(await matchModel(match));
}

/* -------------------------------- form guide ------------------------------- */

export type FormGuide = { home: ("W" | "D" | "L")[]; away: ("W" | "D" | "L")[] };

function resultChip(gf: number, ga: number): "W" | "D" | "L" {
  return gf > ga ? "W" : gf < ga ? "L" : "D";
}

/** Last-five form for both sides (empty arrays when a side has no team record). */
export async function formGuide(homeTeamId: string | null, awayTeamId: string | null): Promise<FormGuide> {
  const [guide] = await formGuides([{ homeTeamId, awayTeamId }]);
  return guide;
}

/**
 * Last-five form for many matches in ONE query (was two per match) — every
 * finished fixture involving the listed teams, newest first.
 */
export async function formGuides(matches: { homeTeamId: string | null; awayTeamId: string | null }[]): Promise<FormGuide[]> {
  const teamIds = [...new Set(matches.flatMap((m) => [m.homeTeamId, m.awayTeamId]).filter((t): t is string => !!t))];
  if (teamIds.length === 0) return matches.map(() => ({ home: [], away: [] }));

  const rows = await prisma.match.findMany({
    where: { status: "FINISHED", OR: teamIds.map((id) => ({ OR: [{ homeTeamId: id }, { awayTeamId: id }] })) },
    orderBy: { finishedAt: "desc" },
    take: 500,
    select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true },
  });

  const last5 = new Map<string, ("W" | "D" | "L")[]>(teamIds.map((id) => [id, []]));
  for (const m of rows) {
    const home = m.homeTeamId ? last5.get(m.homeTeamId) : undefined;
    if (home && home.length < 5) home.push(resultChip(m.homeScore, m.awayScore));
    const away = m.awayTeamId ? last5.get(m.awayTeamId) : undefined;
    if (away && away.length < 5) away.push(resultChip(m.awayScore, m.homeScore));
  }

  return matches.map((m) => ({
    home: (m.homeTeamId && last5.get(m.homeTeamId)) || [],
    away: (m.awayTeamId && last5.get(m.awayTeamId)) || [],
  }));
}
