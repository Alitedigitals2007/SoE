/**
 * Pure pricing maths for every odds market — no I/O, so it can be unit-tested
 * and reused by the in-play repricer.
 *
 * Model:
 *  • Goals are Poisson-distributed around expected goals (xG).
 *  • 1X2 comes from the standings gap (points-per-game), falling back to a
 *    standard home-favourite split.
 *  • Every price is the probability inverted and scaled by MARGIN, so the
 *    book always holds ≈6% overround.
 */

/** Bookmaker margin baked into every price (odds = 0.94 / probability). */
export const MARGIN = 0.94;
export const DEFAULT_XG_HOME = 1.45;
export const DEFAULT_XG_AWAY = 1.25;
/** Default 1X2 split when a competition has no table to read. */
export const DEFAULT_PROBS = { pHome: 0.46, pDraw: 0.27, pAway: 0.27 } as const;
/** Half-ball totals — no pushes, so over + under always settle decisively. */
export const TOTAL_LINES = [0.5, 1.5, 2.5, 3.5, 4.5] as const;
/** Per-team goals lines for the TEAM_TOTALS market. */
export const TEAM_TOTAL_LINES = [0.5, 1.5, 2.5, 3.5] as const;
/** Exact-score matrix resolution (0–10 goals per side → 121 cells). */
export const MAX_SCORE_GOALS = 10;

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Poisson probability of scoring exactly k goals with expected goals λ. */
export function poisson(k: number, lambda: number): number {
  if (k < 0) return 0;
  let fact = 1;
  for (let i = 2; i <= k; i++) fact *= i;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / fact;
}

/** Convert a probability into decimal odds (with margin), sensibly clamped. */
export function price(prob: number): number {
  if (!(prob > 0)) return 80;
  return round2(Math.min(80, Math.max(1.1, MARGIN / prob)));
}

/** Logistic curve over the points-per-game gap: a diff of ~0 → even game. */
export function ppgWinProbability(homePpg: number, awayPpg: number): number {
  return 1 / (1 + Math.exp(-1.1 * (homePpg - awayPpg)));
}

/** 1X2 probabilities from a win prob — home/away share 0.73, draw fixed at 0.27. */
export function outcomeProbsFromWinProb(p: number): { pHome: number; pDraw: number; pAway: number } {
  const pDraw = DEFAULT_PROBS.pDraw;
  const rest = 1 - pDraw;
  return { pHome: rest * p, pDraw, pAway: rest * (1 - p) };
}

/** Expected goals for both sides, split by relative strength (≈2.7-goal game). */
export function expectedGoalsFromWinProb(p: number): { xgHome: number; xgAway: number } {
  const ratio = clamp(p / Math.max(1 - p, 0.02), 0.25, 4);
  return {
    xgHome: clamp(1.35 * Math.sqrt(ratio), 0.5, 3.2),
    xgAway: clamp(1.35 / Math.sqrt(ratio), 0.4, 3.0),
  };
}

/** Poisson probabilities of every scoreline 0..MAX_SCORE_GOALS × 0..MAX_SCORE_GOALS. */
export function scoreMatrix(xgHome: number, xgAway: number): number[] {
  const cells: number[] = [];
  for (let h = 0; h <= MAX_SCORE_GOALS; h++) {
    for (let a = 0; a <= MAX_SCORE_GOALS; a++) {
      cells.push(poisson(h, xgHome) * poisson(a, xgAway));
    }
  }
  return cells;
}

export function exactScoreProbability(xgHome: number, xgAway: number, home: number, away: number): number {
  if (home < 0 || away < 0 || home > MAX_SCORE_GOALS || away > MAX_SCORE_GOALS) return 0;
  return poisson(home, xgHome) * poisson(away, xgAway);
}

/** Total-goals distribution by convolving the two Poisson distributions. */
export function totalGoalsDistribution(xgHome: number, xgAway: number, maxGoals = 24): number[] {
  const total: number[] = [];
  for (let t = 0; t <= maxGoals; t++) {
    let p = 0;
    for (let i = 0; i <= t; i++) p += poisson(i, xgHome) * poisson(t - i, xgAway);
    total.push(p);
  }
  return total;
}

/** Probability that a side concedes at least one (used for BTTS). */
export function probabilityScoresAtLeastOne(xg: number): number {
  return 1 - poisson(0, xg);
}

/* --------------------------- half-time markets ----------------------------- */

/** Share of a side's expected goals scored before the break. */
export const FIRST_HALF_SHARE = 0.46;
/** How far the half-time/full-time convolution is evaluated (tail mass is nil). */
const HT_FT_MAX = 8;

export type ResultKey = "H" | "D" | "A";

export const resultKey = (home: number, away: number): ResultKey =>
  home > away ? "H" : home < away ? "A" : "D";

/** Result codes in the order used by the HALF_FULL market: HH HD HA DH DD DA AH AD AA. */
export const HALF_FULL_CELLS = ["HH", "HD", "HA", "DH", "DD", "DA", "AH", "AD", "AA"] as const;

/**
 * Joint half-time/full-time probabilities. The two halves are modelled as
 * independent Poisson splits of each side's xG, so the full game is exactly
 * the sum of the halves — no hand-waving between the two markets.
 */
export function halfFullProbs(xgHome: number, xgAway: number): Record<string, number> {
  const cells: Record<string, number> = Object.fromEntries(HALF_FULL_CELLS.map((c) => [c, 0]));
  const h1 = Array.from({ length: HT_FT_MAX + 1 }, (_, k) => poisson(k, xgHome * FIRST_HALF_SHARE));
  const h2 = Array.from({ length: HT_FT_MAX + 1 }, (_, k) => poisson(k, xgHome * (1 - FIRST_HALF_SHARE)));
  const a1 = Array.from({ length: HT_FT_MAX + 1 }, (_, k) => poisson(k, xgAway * FIRST_HALF_SHARE));
  const a2 = Array.from({ length: HT_FT_MAX + 1 }, (_, k) => poisson(k, xgAway * (1 - FIRST_HALF_SHARE)));

  for (let kh1 = 0; kh1 <= HT_FT_MAX; kh1++) {
    for (let la1 = 0; la1 <= HT_FT_MAX; la1++) {
      const ht = resultKey(kh1, la1);
      const pHalf = h1[kh1] * a1[la1];
      if (pHalf === 0) continue;
      for (let kh2 = 0; kh2 <= HT_FT_MAX; kh2++) {
        const pH2 = h2[kh2];
        if (pH2 === 0) continue;
        for (let la2 = 0; la2 <= HT_FT_MAX; la2++) {
          const p = pH2 * a2[la2];
          if (p === 0) continue;
          const ft = resultKey(kh1 + kh2, la1 + la2);
          cells[`${ht}${ft}`] += pHalf * p;
        }
      }
    }
  }
  return cells;
}

/** Half-time result probabilities (marginal of the half/full grid). */
export function halfResultProbs(xgHome: number, xgAway: number): Record<ResultKey, number> {
  const cells = halfFullProbs(xgHome, xgAway);
  return {
    H: cells.HH + cells.HD + cells.HA,
    D: cells.DH + cells.DD + cells.DA,
    A: cells.AH + cells.AD + cells.AA,
  };
}

/* ----------------------------- derived markets ----------------------------- */

/** Double chance: 1X (home or draw), X2 (draw or away), 12 (either side wins). */
export function doubleChanceProbs(p: { pHome: number; pDraw: number; pAway: number }) {
  return {
    "1X": p.pHome + p.pDraw,
    X2: p.pDraw + p.pAway,
    "12": p.pHome + p.pAway,
  } as Record<string, number>;
}

/** Draw-no-bet: the draw removes stake, so the two outcomes are renormalised. */
export function drawNoBetProbs(p: { pHome: number; pAway: number }) {
  const total = p.pHome + p.pAway || 1;
  return { HOME: p.pHome / total, AWAY: p.pAway / total };
}

/** Over-probability for a goals line (strictly greater — half-ball lines). */
export function overProbability(xg: number, line: number): number {
  let p = 0;
  for (let k = 0; k <= 60; k++) if (k > line) p += poisson(k, xg);
  return Math.min(1, p);
}

/** Per-team over/under probabilities for the TEAM_TOTALS market. */
export function teamTotalProbs(xg: number, lines: readonly number[]): Record<string, { over: number; under: number }> {
  const out: Record<string, { over: number; under: number }> = {};
  for (const line of lines) {
    const over = overProbability(xg, line);
    out[String(line)] = { over, under: 1 - over };
  }
  return out;
}
