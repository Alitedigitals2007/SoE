import { describe, expect, it } from "vitest";
import {
  MOTM_ASSIST_POINTS,
  MOTM_DECIDING_GOAL_BONUS,
  MOTM_GOAL_POINTS,
  MOTM_RED_POINTS,
  MOTM_YELLOW_POINTS,
  scoreMotm,
} from "@/lib/match/motm";

type RosterSlot = { userId: string; team: "HOME" | "AWAY"; user: { id: string; name: string } };

function input(overrides: Partial<Parameters<typeof scoreMotm>[0]> = {}): Parameters<typeof scoreMotm>[0] {
  const roster: RosterSlot[] = [
    { userId: "u1", team: "HOME", user: { id: "u1", name: "Striker" } },
    { userId: "u2", team: "HOME", user: { id: "u2", name: "Playmaker" } },
    { userId: "u3", team: "AWAY", user: { id: "u3", name: "Target Man" } },
    { userId: "u4", team: "AWAY", user: { id: "u4", name: "Winger" } },
  ];
  return {
    homeScore: 2,
    awayScore: 1,
    roster,
    rounds: [],
    incidents: [],
    ...overrides,
  };
}

const goal = (userId: string) => ({
  decision: "GOAL",
  goalSubmission: { player: { userId } },
  assistPlayer: null,
});

describe("scoreMotm", () => {
  it("scores goals and assists with the documented points", () => {
    const candidates = scoreMotm(
      input({
        rounds: [
          goal("u1"),
          { decision: "GOAL", goalSubmission: { player: { userId: "u1" } }, assistPlayer: { userId: "u2" } },
          goal("u3"),
        ],
      }),
    );
    const striker = candidates.find((c) => c.userId === "u1")!;
    const playmaker = candidates.find((c) => c.userId === "u2")!;
    expect(striker.goals).toBe(2);
    // 2–1 final: the winner's last goal (u1's second) earns the deciding bonus.
    expect(striker.decidingGoal).toBe(true);
    expect(striker.points).toBe(2 * MOTM_GOAL_POINTS + MOTM_DECIDING_GOAL_BONUS);
    expect(playmaker.assists).toBe(1);
    expect(playmaker.points).toBe(MOTM_ASSIST_POINTS);
    expect(candidates[0].userId).toBe("u1");
  });

  it("awards the deciding-goal bonus in a one-goal game to the winner's last scorer", () => {
    const candidates = scoreMotm(
      input({
        homeScore: 1,
        awayScore: 0,
        rounds: [goal("u1")],
      }),
    );
    const striker = candidates.find((c) => c.userId === "u1")!;
    expect(striker.decidingGoal).toBe(true);
    expect(striker.points).toBe(MOTM_GOAL_POINTS + MOTM_DECIDING_GOAL_BONUS);
  });

  it("does not award a deciding-goal bonus in a two-goal game", () => {
    const candidates = scoreMotm(
      input({
        homeScore: 2,
        awayScore: 0,
        rounds: [goal("u1"), goal("u2")],
      }),
    );
    expect(candidates.every((c) => !c.decidingGoal)).toBe(true);
  });

  it("penalises cards and clamps at zero", () => {
    const candidates = scoreMotm(
      input({
        rounds: [],
        incidents: [
          { action: "YELLOW_CARD", player: { userId: "u3" } },
          { action: "RED_CARD", player: { userId: "u4" } },
        ],
      }),
    );
    const booked = candidates.find((c) => c.userId === "u3")!;
    const sentOff = candidates.find((c) => c.userId === "u4")!;
    expect(booked.points).toBe(0); // −1 clamped to 0
    expect(sentOff.redCards).toBe(1);
    expect(sentOff.points).toBe(0); // −3 clamped to 0
    expect(MOTM_YELLOW_POINTS).toBe(-1);
    expect(MOTM_RED_POINTS).toBe(-3);
  });

  it("breaks ties on goals, then assists", () => {
    const candidates = scoreMotm(
      input({
        homeScore: 2,
        awayScore: 0, // no deciding-goal bonus — margin is two
        rounds: [
          { decision: "GOAL", goalSubmission: { player: { userId: "u1" } }, assistPlayer: { userId: "u2" } },
          { decision: "GOAL", goalSubmission: { player: { userId: "u2" } }, assistPlayer: { userId: "u1" } },
        ],
      }),
    );
    // u1 and u2 both end on 1 goal + 1 assist → tie broken by name:
    // "Playmaker" (u2) sorts before "Striker" (u1).
    expect(candidates[0].points).toBe(candidates[1].points);
    expect(candidates.map((c) => c.userId)).toEqual(["u2", "u1"]);
  });
});
