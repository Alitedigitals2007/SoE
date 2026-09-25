import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { inPlayPrices } from "@/lib/bet/liveOdds";
import { MATCH_ROUNDS } from "@/lib/domain";

/** Rough implied-probability sum for a two-way market with a 6% margin. */
const implied = (a: number, b: number) => 1 / a + 1 / b;

describe("inPlayPrices", () => {
  it("is decisive once every question has been answered", () => {
    const p = inPlayPrices(1.4, 1.1, MATCH_ROUNDS, { home: 1, away: 0 });
    expect(p.home).toBeLessThan(1.2); // home win locked in
    expect(p.draw).toBeGreaterThan(60);
    expect(p.away).toBeGreaterThan(60);
    expect(p.bttsNo).toBeLessThan(1.2); // nobody scored
    expect(p.under25).toBeLessThan(1.2); // one goal total
  });

  it("starts from a level, undecided game with balanced prices", () => {
    const p = inPlayPrices(1.4, 1.2, 0, { home: 0, away: 0 });
    expect(p.home).toBeGreaterThan(1.5);
    expect(p.away).toBeGreaterThan(1.5);
    expect(p.draw).toBeGreaterThan(2.5);
    expect(p.draw).toBeLessThan(60);
    // a tight in-play market still holds a margin over 100%
    expect(implied(p.home, p.draw) + 1 / p.away).toBeGreaterThan(1);
    expect(implied(p.home, p.draw) + 1 / p.away).toBeLessThan(1.35);
  });

  it("reacts to the score already on the board", () => {
    const level = inPlayPrices(1.4, 1.4, 6, { home: 0, away: 0 });
    const lead = inPlayPrices(1.4, 1.4, 6, { home: 2, away: 0 });
    expect(lead.home).toBeLessThan(level.home);
    expect(lead.away).toBeGreaterThan(level.away);
    // two goals are already on the board, so over 2.5 only needs one more
    expect(lead.over25).toBeLessThan(level.over25);
  });

  it("keeps over/under a proper two-way market", () => {
    const p = inPlayPrices(1.6, 1.0, 4, { home: 1, away: 1 });
    expect(implied(p.over25, p.under25)).toBeGreaterThan(1);
    expect(implied(p.over25, p.under25)).toBeLessThan(1.2);
    expect(p.bttsYes).toBeGreaterThan(1);
  });
});
