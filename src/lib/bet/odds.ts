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

type MatchTeams = {
  competitionId: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
};

type Strength = { ppg: number } | null;

async function teamStrengths(competitionId: string, homeTeamId: string, awayTeamId: string): Promise<[Strength, Strength]> {
  // League/group fixtures only (cupRound null) — knockouts skew the table.
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
  const toPpg = (id: string | null): Strength => {
    if (!id) return null;
    const s = stats.get(id);
    if (!s || s.played === 0) return null;
    return { ppg: s.pts / s.played };
  };
  return [toPpg(homeTeamId), toPpg(awayTeamId)];
}

/** Win/draw/win probabilities: standings-based when a table exists, standard otherwise. */
async function outcomeProbs(match: MatchTeams): Promise<{ pHome: number; pDraw: number; pAway: number; source: MatchOdds["source"] }> {
  if (match.competitionId && match.homeTeamId && match.awayTeamId) {
    const [home, away] = await teamStrengths(match.competitionId, match.homeTeamId, match.awayTeamId);
    if (home && away) {
      const probs = outcomeProbsFromWinProb(ppgWinProbability(home.ppg, away.ppg));
      return { ...probs, source: "table" };
    }
  }
  return { ...DEFAULT_PROBS, source: "default" };
}

/** Expected goals for both sides, split by relative strength (≈2.7-goal game). */
export async function expectedGoals(match: MatchTeams): Promise<{ xgHome: number; xgAway: number }> {
  if (match.competitionId && match.homeTeamId && match.awayTeamId) {
    const [home, away] = await teamStrengths(match.competitionId, match.homeTeamId, match.awayTeamId);
    if (home && away) return expectedGoalsFromWinProb(ppgWinProbability(home.ppg, away.ppg));
  }
  return { xgHome: DEFAULT_XG_HOME, xgAway: DEFAULT_XG_AWAY };
}

/** Auto odds for a match: 1X2 + exact-score matrix (0–10 per side). */
export async function oddsForMatch(match: MatchTeams): Promise<MatchOdds> {
  return (await allOdds(match)).match;
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
  const [{ pHome, pDraw, pAway, source }, { xgHome, xgAway }] = await Promise.all([
    outcomeProbs(match),
    expectedGoals(match),
  ]);
  return priceAll({ pHome, pDraw, pAway, source, xgHome, xgAway });
}

/* -------------------------------- form guide ------------------------------- */

export type FormGuide = { home: ("W" | "D" | "L")[]; away: ("W" | "D" | "L")[] };

async function lastFive(teamId: string): Promise<("W" | "D" | "L")[]> {
  const rows = await prisma.match.findMany({
    where: { status: "FINISHED", OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
    orderBy: { finishedAt: "desc" },
    take: 5,
    select: { homeTeamId: true, homeScore: true, awayScore: true },
  });
  return rows.map((m) => {
    const gf = m.homeTeamId === teamId ? m.homeScore : m.awayScore;
    const ga = m.homeTeamId === teamId ? m.awayScore : m.homeScore;
    return gf > ga ? "W" : gf < ga ? "L" : "D";
  });
}

/** Last-five form for both sides (empty arrays when a side has no team record). */
export async function formGuide(homeTeamId: string | null, awayTeamId: string | null): Promise<FormGuide> {
  const [home, away] = await Promise.all([
    homeTeamId ? lastFive(homeTeamId) : Promise.resolve([]),
    awayTeamId ? lastFive(awayTeamId) : Promise.resolve([]),
  ]);
  return { home, away };
}
