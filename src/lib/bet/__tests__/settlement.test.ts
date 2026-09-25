import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { accaOutcome, payoutFor, selectionOutcome, selectionWins } from "@/lib/bet/engine";

type S = { home: number; away: number; ht: { home: number; away: number } | null };

const full = (home: number, away: number, ht: { home: number; away: number } | null = null): S => ({
  home,
  away,
  ht,
});

describe("selectionWins (full-time scoreline)", () => {
  it("judges 1X2", () => {
    expect(selectionWins("MATCH_RESULT", "HOME", 2, 1)).toBe(true);
    expect(selectionWins("MATCH_RESULT", "HOME", 1, 1)).toBe(false);
    expect(selectionWins("MATCH_RESULT", "DRAW", 1, 1)).toBe(true);
    expect(selectionWins("MATCH_RESULT", "AWAY", 0, 3)).toBe(true);
  });

  it("judges exact score, totals and BTTS", () => {
    expect(selectionWins("EXACT_SCORE", "2-1", 2, 1)).toBe(true);
    expect(selectionWins("EXACT_SCORE", "2-1", 1, 2)).toBe(false);
    expect(selectionWins("TOTAL_GOALS", "O2.5", 2, 1)).toBe(true);
    expect(selectionWins("TOTAL_GOALS", "U2.5", 1, 1)).toBe(true);
    expect(selectionWins("BOTH_TEAMS_TO_SCORE", "YES", 1, 1)).toBe(true);
    expect(selectionWins("BOTH_TEAMS_TO_SCORE", "NO", 2, 0)).toBe(true);
  });

  it("judges double chance", () => {
    expect(selectionWins("DOUBLE_CHANCE", "1X", 2, 1)).toBe(true);
    expect(selectionWins("DOUBLE_CHANCE", "1X", 1, 1)).toBe(true);
    expect(selectionWins("DOUBLE_CHANCE", "1X", 0, 1)).toBe(false);
    expect(selectionWins("DOUBLE_CHANCE", "X2", 1, 1)).toBe(true);
    expect(selectionWins("DOUBLE_CHANCE", "X2", 1, 2)).toBe(true);
    expect(selectionWins("DOUBLE_CHANCE", "X2", 2, 1)).toBe(false);
    expect(selectionWins("DOUBLE_CHANCE", "12", 2, 1)).toBe(true);
    expect(selectionWins("DOUBLE_CHANCE", "12", 1, 2)).toBe(true);
    expect(selectionWins("DOUBLE_CHANCE", "12", 1, 1)).toBe(false);
  });

  it("judges team totals against each side's goals", () => {
    expect(selectionWins("TEAM_TOTALS", "H_O2.5", 3, 0)).toBe(true);
    expect(selectionWins("TEAM_TOTALS", "H_O2.5", 2, 4)).toBe(false);
    expect(selectionWins("TEAM_TOTALS", "H_U2.5", 2, 5)).toBe(true);
    expect(selectionWins("TEAM_TOTALS", "A_U1.5", 4, 1)).toBe(true); // away scored one
    expect(selectionWins("TEAM_TOTALS", "A_U1.5", 4, 2)).toBe(false); // away scored two
    expect(selectionWins("TEAM_TOTALS", "A_O1.5", 0, 2)).toBe(true);
  });
});

describe("selectionOutcome — half-time aware markets", () => {
  it("voids draw-no-bet on a draw, wins/losses otherwise", () => {
    expect(selectionOutcome("DRAW_NO_BET", "HOME", full(2, 1))).toBe("WON");
    expect(selectionOutcome("DRAW_NO_BET", "HOME", full(1, 2))).toBe("LOST");
    expect(selectionOutcome("DRAW_NO_BET", "AWAY", full(2, 1))).toBe("LOST");
    expect(selectionOutcome("DRAW_NO_BET", "HOME", full(1, 1))).toBe("VOID");
    expect(selectionOutcome("DRAW_NO_BET", "AWAY", full(1, 1))).toBe("VOID");
  });

  it("voids half-time markets when the break never produced a scoreline", () => {
    expect(selectionOutcome("HALF_RESULT", "HOME", full(3, 0, null))).toBe("VOID");
    expect(selectionOutcome("HALF_FULL", "HH", full(3, 0, null))).toBe("VOID");
  });

  it("judges half-time result on the break only", () => {
    // 1-0 at the break, 1-2 at full time: home led at HT, lost the match.
    expect(selectionOutcome("HALF_RESULT", "HOME", full(1, 2, { home: 1, away: 0 }))).toBe("WON");
    expect(selectionOutcome("HALF_RESULT", "AWAY", full(1, 2, { home: 1, away: 0 }))).toBe("LOST");
    expect(selectionOutcome("HALF_RESULT", "DRAW", full(2, 0, { home: 0, away: 0 }))).toBe("WON");
  });

  it("judges HT/FT on both halves", () => {
    // Home led at the break but lost the match 1-2 → "HA".
    expect(selectionOutcome("HALF_FULL", "HA", full(1, 2, { home: 1, away: 0 }))).toBe("WON");
    expect(selectionOutcome("HALF_FULL", "HH", full(1, 2, { home: 1, away: 0 }))).toBe("LOST");
    expect(selectionOutcome("HALF_FULL", "HD", full(1, 2, { home: 1, away: 0 }))).toBe("LOST");
    expect(selectionOutcome("HALF_FULL", "AA", full(0, 2, { home: 0, away: 1 }))).toBe("WON");
    expect(selectionOutcome("HALF_FULL", "DA", full(1, 3, { home: 0, away: 0 }))).toBe("WON");
  });

  it("falls back to the full-time scoreline for regular markets", () => {
    expect(selectionOutcome("MATCH_RESULT", "AWAY", full(0, 1))).toBe("WON");
    expect(selectionOutcome("TOTAL_GOALS", "O3.5", full(2, 1))).toBe("LOST");
    expect(selectionOutcome("BOTH_TEAMS_TO_SCORE", "NO", full(2, 0))).toBe("WON");
    expect(selectionOutcome("EXACT_SCORE", "2-2", full(2, 1))).toBe("LOST");
  });
});

describe("payoutFor", () => {
  it("pays winnings, refunds voids, pays nothing on a loss", () => {
    expect(payoutFor("WON", 10, 25)).toBe(25);
    expect(payoutFor("VOID", 10, 25)).toBe(10);
    expect(payoutFor("LOST", 10, 25)).toBe(0);
    expect(payoutFor("PENDING", 10, 25)).toBe(0);
  });
});

describe("accaOutcome", () => {
  it("waits while any leg is unfinished", () => {
    expect(accaOutcome([null, null])).toBe("PENDING");
    expect(accaOutcome(["WON", null])).toBe("PENDING");
    expect(accaOutcome(["WON", "WON", null])).toBe("PENDING");
  });

  it("wins only when every leg lands", () => {
    expect(accaOutcome(["WON", "WON"])).toBe("WON");
    expect(accaOutcome(["WON", "WON", "WON"])).toBe("WON");
  });

  it("loses as soon as one leg loses, even with legs still open", () => {
    expect(accaOutcome(["LOST", null])).toBe("LOST");
    expect(accaOutcome(["WON", "LOST", "WON"])).toBe("LOST");
    expect(accaOutcome(["VOID", "LOST"])).toBe("LOST");
  });

  it("voids the whole slip when a leg is voided and everything else is done", () => {
    expect(accaOutcome(["WON", "VOID"])).toBe("VOID");
    expect(accaOutcome(["VOID", "VOID"])).toBe("VOID");
  });
});
