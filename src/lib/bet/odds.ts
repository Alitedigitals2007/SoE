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
  /** Exact-score grid, home goals 0–4 × away goals 0–4. */
  scores: ExactScoreOdd[];
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

/** Auto odds for a match: 1X2 + exact-score grid. */
export async function oddsForMatch(match: MatchTeams): Promise<MatchOdds> {
  const [{ pHome, pDraw, pAway, source }, { xgHome, xgAway }] = await Promise.all([
    outcomeProbs(match),
    expectedGoals(match),
  ]);

  const scores: ExactScoreOdd[] = [];
  for (let h = 0; h <= 4; h++) {
    for (let a = 0; a <= 4; a++) {
      scores.push({ home: h, away: a, odds: price(poisson(h, xgHome) * poisson(a, xgAway)) });
    }
  }

  return { home: price(pHome), draw: price(pDraw), away: price(pAway), scores, source };
}

/** Odds for a single exact scoreline (0–9 per side), e.g. when placing a bet. */
export async function exactScoreOdds(match: MatchTeams, homeGoals: number, awayGoals: number): Promise<number> {
  const { xgHome, xgAway } = await expectedGoals(match);
  return price(poisson(homeGoals, xgHome) * poisson(awayGoals, xgAway));
}
