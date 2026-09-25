import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROBS,
  MAX_SCORE_GOALS,
  MARGIN,
  clamp,
  exactScoreProbability,
  expectedGoalsFromWinProb,
  outcomeProbsFromWinProb,
  poisson,
  ppgWinProbability,
  price,
  probabilityScoresAtLeastOne,
  scoreMatrix,
  totalGoalsDistribution,
} from "@/lib/bet/pricing";

describe("poisson", () => {
  it("matches the closed form for k = 0 and k = 1", () => {
    const lambda = 1.45;
    expect(poisson(0, lambda)).toBeCloseTo(Math.exp(-lambda), 12);
    expect(poisson(1, lambda)).toBeCloseTo(Math.exp(-lambda) * lambda, 12);
  });

  it("sums to ~1 across all plausible goal counts", () => {
    for (const lambda of [0.4, 1.45, 3.2]) {
      let sum = 0;
      for (let k = 0; k <= 200; k++) sum += poisson(k, lambda);
      expect(sum).toBeCloseTo(1, 6);
    }
  });

  it("never returns a negative-k mass", () => {
    expect(poisson(-1, 1.5)).toBe(0);
  });
});

describe("price", () => {
  it("inverts the probability with the bookmaker margin", () => {
    expect(price(0.5)).toBeCloseTo(MARGIN / 0.5, 2);
    expect(price(0.27)).toBeCloseTo(MARGIN / 0.27, 2);
  });

  it("keeps every price above 1 and capped at 80", () => {
    expect(price(0.999)).toBeGreaterThanOrEqual(1.1);
    expect(price(0.0001)).toBeLessThanOrEqual(80);
    expect(price(0)).toBe(80);
  });

  it("holds a positive overround — the sum of implied probs exceeds 1", () => {
    const probs = [0.46, 0.27, 0.27];
    const implied = probs.reduce((acc, p) => acc + 1 / price(p), 0);
    expect(implied).toBeGreaterThan(1);
    expect(implied).toBeCloseTo(1 / MARGIN, 1);
  });
});

describe("outcomeProbsFromWinProb", () => {
  it("always sums to 1", () => {
    for (const p of [0, 0.2, 0.5, 0.8, 1]) {
      const { pHome, pDraw, pAway } = outcomeProbsFromWinProb(p);
      expect(pHome + pDraw + pAway).toBeCloseTo(1, 10);
    }
  });

  it("is symmetric for an even game", () => {
    const { pHome, pAway } = outcomeProbsFromWinProb(0.5);
    expect(pHome).toBeCloseTo(pAway, 10);
  });

  it("uses the documented default split", () => {
    expect(DEFAULT_PROBS.pHome + DEFAULT_PROBS.pDraw + DEFAULT_PROBS.pAway).toBeCloseTo(1, 10);
  });
});

describe("ppgWinProbability", () => {
  it("is 0.5 when the sides are level", () => {
    expect(ppgWinProbability(1.5, 1.5)).toBeCloseTo(0.5, 10);
  });

  it("rises as the home side's points-per-game gap grows", () => {
    expect(ppgWinProbability(2.5, 1.0)).toBeGreaterThan(0.5);
    expect(ppgWinProbability(1.0, 2.5)).toBeLessThan(0.5);
  });
});

describe("expectedGoalsFromWinProb", () => {
  it("splits a level game evenly at 1.35 each (≈2.7 goals)", () => {
    const { xgHome, xgAway } = expectedGoalsFromWinProb(0.5);
    expect(xgHome).toBeCloseTo(1.35, 6);
    expect(xgAway).toBeCloseTo(1.35, 6);
    expect(xgHome + xgAway).toBeCloseTo(2.7, 6);
  });

  it("stays inside the documented clamps", () => {
    for (const p of [0, 0.1, 0.35, 0.5, 0.7, 0.95, 1]) {
      const { xgHome, xgAway } = expectedGoalsFromWinProb(p);
      expect(xgHome).toBeGreaterThanOrEqual(0.5);
      expect(xgHome).toBeLessThanOrEqual(3.2);
      expect(xgAway).toBeGreaterThanOrEqual(0.4);
      expect(xgAway).toBeLessThanOrEqual(3.0);
    }
  });

  it("shifts goals toward the stronger side", () => {
    const strong = expectedGoalsFromWinProb(0.85);
    expect(strong.xgHome).toBeGreaterThan(strong.xgAway);
  });
});

describe("score markets", () => {
  it("produces a 0–10 × 0–10 matrix (121 cells)", () => {
    const cells = scoreMatrix(1.45, 1.25);
    expect(cells).toHaveLength((MAX_SCORE_GOALS + 1) ** 2);
    expect(cells.every((c) => c > 0)).toBe(true);
    expect(cells[0]).toBeCloseTo(poisson(0, 1.45) * poisson(0, 1.25), 12);
  });

  it("covers nearly all of the probability mass for realistic xG", () => {
    const sum = scoreMatrix(1.45, 1.25).reduce((a, b) => a + b, 0);
    expect(sum).toBeGreaterThan(0.97);
    expect(sum).toBeLessThanOrEqual(1);
  });

  it("prices only scores inside the 0–10 window", () => {
    expect(exactScoreProbability(1.5, 1.0, 1, 1)).toBeCloseTo(poisson(1, 1.5) * poisson(1, 1.0), 12);
    expect(exactScoreProbability(1.5, 1.0, 11, 0)).toBe(0);
    expect(exactScoreProbability(1.5, 1.0, -1, 0)).toBe(0);
  });

  it("convolves to a total-goals distribution that sums to ~1", () => {
    const total = totalGoalsDistribution(1.45, 1.25);
    const sum = total.reduce((a, b) => a + b, 0);
    expect(sum).toBeGreaterThan(0.999);
    expect(total[0]).toBeCloseTo(poisson(0, 1.45) * poisson(0, 1.25), 12);
  });
});

describe("goals helpers", () => {
  it("BTTS: no chance of scoring with zero xG", () => {
    expect(probabilityScoresAtLeastOne(0)).toBe(0);
    expect(probabilityScoresAtLeastOne(2)).toBeGreaterThan(probabilityScoresAtLeastOne(1));
    expect(probabilityScoresAtLeastOne(1)).toBeLessThan(1);
  });

  it("clamp is a pure range helper", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-5, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});
