import { prisma } from "@/lib/prisma";

/** Bookmaker margin baked into every price (odds = 0.94 / probability). */
const MARGIN = 0.94;
const DEFAULT_XG_HOME = 1.45;
const DEFAULT_XG_AWAY = 1.25;

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

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Poisson probability of scoring exactly k goals with expected goals λ. */
function poisson(k: number, lambda: number): number {
  let fact = 1;
  for (let i = 2; i <= k; i++) fact *= i;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / fact;
}

/** Convert a probability into decimal odds (with margin), sensibly clamped. */
function price(prob: number): number {
  return round2(Math.min(80, Math.max(1.1, MARGIN / prob)));
}

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
      // Logistic curve over the points-per-game gap: diff of ~0 → even game.
      const p = 1 / (1 + Math.exp(-1.1 * (home.ppg - away.ppg)));
      return { pHome: 0.73 * p, pDraw: 0.27, pAway: 0.73 * (1 - p), source: "table" };
    }
  }
  return { pHome: 0.46, pDraw: 0.27, pAway: 0.27, source: "default" };
}

/** Expected goals for both sides, split by relative strength (≈2.7-goal game). */
async function expectedGoals(match: MatchTeams): Promise<{ xgHome: number; xgAway: number }> {
  if (match.competitionId && match.homeTeamId && match.awayTeamId) {
    const [home, away] = await teamStrengths(match.competitionId, match.homeTeamId, match.awayTeamId);
    if (home && away) {
      const p = 1 / (1 + Math.exp(-1.1 * (home.ppg - away.ppg)));
      const ratio = clamp(p / Math.max(1 - p, 0.02), 0.25, 4);
      return {
        xgHome: clamp(1.35 * Math.sqrt(ratio), 0.5, 3.2),
        xgAway: clamp(1.35 / Math.sqrt(ratio), 0.4, 3.0),
      };
    }
  }
  return { xgHome: DEFAULT_XG_HOME, xgAway: DEFAULT_XG_AWAY };
}

/** Auto odds for a match: 1X2 + exact-score matrix (0–10 per side). */
export async function oddsForMatch(match: MatchTeams): Promise<MatchOdds> {
  const [{ pHome, pDraw, pAway, source }, { xgHome, xgAway }] = await Promise.all([
    outcomeProbs(match),
    expectedGoals(match),
  ]);

  const scoreOdds: number[] = [];
  for (let h = 0; h <= 10; h++) {
    for (let a = 0; a <= 10; a++) {
      scoreOdds.push(price(poisson(h, xgHome) * poisson(a, xgAway)));
    }
  }

  return { home: price(pHome), draw: price(pDraw), away: price(pAway), scoreOdds, source };
}

/** Odds for a single exact scoreline (0–10 goals per side), e.g. when placing a bet. */
export async function exactScoreOdds(match: MatchTeams, homeGoals: number, awayGoals: number): Promise<number> {
  const { xgHome, xgAway } = await expectedGoals(match);
  return price(poisson(homeGoals, xgHome) * poisson(awayGoals, xgAway));
}

/* ------------------------------- goals markets ----------------------------- */

export type GoalsOdds = {
  btts: { yes: number; no: number };
  /** Classic over/under lines (half-ball, so no pushes). */
  lines: { line: number; over: number; under: number }[];
};

const TOTAL_LINES = [1.5, 2.5, 3.5];

/** Over/under + both-teams-to-score prices from the same expected-goals model. */
export async function goalsOdds(match: MatchTeams): Promise<GoalsOdds> {
  const { xgHome, xgAway } = await expectedGoals(match);

  // Convolve the two Poisson distributions into a total-goals distribution.
  const maxGoals = 20;
  const total: number[] = [];
  for (let t = 0; t <= maxGoals; t++) {
    let p = 0;
    for (let i = 0; i <= t; i++) p += poisson(i, xgHome) * poisson(t - i, xgAway);
    total.push(p);
  }

  const lines = TOTAL_LINES.map((line) => {
    const pOver = total.reduce((acc, p, t) => (t > line ? acc + p : acc), 0);
    return { line, over: price(pOver), under: price(1 - pOver) };
  });

  const pBtts = (1 - poisson(0, xgHome)) * (1 - poisson(0, xgAway));
  return { btts: { yes: price(pBtts), no: price(1 - pBtts) }, lines };
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
