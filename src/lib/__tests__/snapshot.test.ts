import { describe, it, expect } from "vitest";
import { buildSnapshot, type MatchFull } from "@/lib/match/snapshot";

function makeMatch(overrides: Partial<MatchFull> = {}): MatchFull {
  return {
    id: "m1",
    code: "AB12CD",
    status: "DRAFT",
    homeName: "Home FC",
    awayName: "Away Utd",
    homeScore: 0,
    awayScore: 0,
    version: 1,
    countdownSeconds: 15,
    currentRound: 0,
    startedAt: null,
    finishedAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    refereeId: "ref1",
    competitionId: null,
    referee: { id: "ref1", name: "Ref One" },
    roster: [],
    rounds: [],
    timeline: [],
    questions: [],
    incidents: [],
    substitutions: [],
    requests: [],
    _count: { roster: 0 },
    ...overrides,
  } as unknown as MatchFull;
}

describe("buildSnapshot", () => {
  it("returns basic fields for a draft match", () => {
    const match = makeMatch();
    const snap = buildSnapshot(match, { role: "PUBLIC", userId: null });

    expect(snap.code).toBe("AB12CD");
    expect(snap.status).toBe("DRAFT");
    expect(snap.homeName).toBe("Home FC");
    expect(snap.awayName).toBe("Away Utd");
    expect(snap.round).toBeNull();
    expect(snap.summary).toBeNull();
    expect(snap.viewer.isReferee).toBe(false);
    expect(snap.viewer.isAdmin).toBe(false);
  });

  it("sets isReferee for ADMIN role", () => {
    const match = makeMatch();
    const snap = buildSnapshot(match, { role: "ADMIN", userId: "admin1" });

    expect(snap.viewer.isAdmin).toBe(true);
    expect(snap.viewer.isReferee).toBe(true);
  });

  it("sets isReferee for the assigned REFEREE", () => {
    const match = makeMatch();
    const snap = buildSnapshot(match, { role: "REFEREE", userId: "ref1" });

    expect(snap.viewer.isReferee).toBe(true);
  });

  it("does not set isReferee for other REFEREEs", () => {
    const match = makeMatch();
    const snap = buildSnapshot(match, { role: "REFEREE", userId: "ref2" });

    expect(snap.viewer.isReferee).toBe(false);
  });

  it("returns summary for finished match", () => {
    const match = makeMatch({ status: "FINISHED", finishedAt: new Date() });
    const snap = buildSnapshot(match, { role: "PUBLIC", userId: null });

    expect(snap.summary).not.toBeNull();
    expect(snap.summary?.homeScore).toBe(0);
  });

  it("returns roster with correct shape", () => {
    const match = makeMatch({
      roster: [
        {
          id: "slot1",
          userId: "u1",
          team: "HOME",
          number: 1,
          role: "STARTER",
          isCaptain: true,
          user: { id: "u1", name: "Player 1" },
        },
      ] as any,
    });
    const snap = buildSnapshot(match, { role: "PUBLIC", userId: null });

    expect(snap.roster).toHaveLength(1);
    expect(snap.roster[0].name).toBe("Player 1");
    expect(snap.roster[0].team).toBe("HOME");
    expect(snap.roster[0].isCaptain).toBe(true);
  });

  it("shows active round when OPEN", () => {
    const match = makeMatch({
      status: "LIVE",
      rounds: [
        {
          number: 1,
          status: "OPEN",
          closesAt: new Date(Date.now() + 30000),
          questionId: "q1",
          decision: null,
          goalSubmissionId: null,
          openedAt: new Date(),
          lockedAt: null,
          decidedAt: null,
          question: { id: "q1", text: "What is 2+2?", referenceAnswer: "4" },
          submissions: [],
          goalSubmission: null,
        },
      ] as any,
    });
    const snap = buildSnapshot(match, { role: "PUBLIC", userId: null });

    expect(snap.round).not.toBeNull();
    expect(snap.round?.number).toBe(1);
    expect(snap.round?.status).toBe("OPEN");
    expect(snap.round?.questionText).toBe("What is 2+2?");
  });

  it("hides question text for spectators on PENDING rounds", () => {
    const match = makeMatch({
      status: "LIVE",
      rounds: [
        {
          number: 1,
          status: "PENDING",
          closesAt: null,
          questionId: "q1",
          decision: null,
          goalSubmissionId: null,
          openedAt: null,
          lockedAt: null,
          decidedAt: null,
          question: { id: "q1", text: "Secret Q", referenceAnswer: "4" },
          submissions: [],
          goalSubmission: null,
        },
      ] as any,
    });
    const snap = buildSnapshot(match, { role: "PUBLIC", userId: null });

    expect(snap.round?.questionText ?? null).toBeNull();
  });

  it("shows correct answer for referee on LOCKED round", () => {
    const match = makeMatch({
      status: "LIVE",
      rounds: [
        {
          number: 1,
          status: "LOCKED",
          closesAt: new Date(Date.now() - 1000),
          questionId: "q1",
          decision: null,
          goalSubmissionId: null,
          openedAt: new Date(Date.now() - 30000),
          lockedAt: new Date(),
          decidedAt: null,
          question: { id: "q1", text: "Q1", referenceAnswer: "Paris" },
          submissions: [],
          goalSubmission: null,
        },
      ] as any,
    });
    const snap = buildSnapshot(match, { role: "REFEREE", userId: "ref1" });

    expect(snap.round?.correctAnswer).toBe("Paris");
    expect(snap.round?.awaitingReferee).toBe(true);
  });

  it("hides correct answer from spectators on LOCKED round", () => {
    const match = makeMatch({
      status: "LIVE",
      rounds: [
        {
          number: 1,
          status: "LOCKED",
          closesAt: new Date(Date.now() - 1000),
          questionId: "q1",
          decision: null,
          goalSubmissionId: null,
          openedAt: new Date(Date.now() - 30000),
          lockedAt: new Date(),
          decidedAt: null,
          question: { id: "q1", text: "Q1", referenceAnswer: "Paris" },
          submissions: [],
          goalSubmission: null,
        },
      ] as any,
    });
    const snap = buildSnapshot(match, { role: "PUBLIC", userId: null });

    expect(snap.round?.correctAnswer).toBeNull();
  });

  it("includes player context for PLAYER viewers", () => {
    const match = makeMatch({
      status: "LIVE",
      rounds: [
        {
          number: 1,
          status: "OPEN",
          closesAt: new Date(Date.now() + 30000),
          questionId: "q1",
          decision: null,
          goalSubmissionId: null,
          openedAt: new Date(),
          lockedAt: null,
          decidedAt: null,
          question: { id: "q1", text: "Q1", referenceAnswer: "A1" },
          submissions: [],
          goalSubmission: null,
        },
      ] as any,
      roster: [
        {
          id: "slot1",
          userId: "p1",
          team: "HOME",
          number: 1,
          role: "STARTER",
          isCaptain: false,
          user: { id: "p1", name: "Player 1" },
        },
      ] as any,
    });
    const snap = buildSnapshot(match, { role: "PLAYER", userId: "p1" });

    expect(snap.viewer.player).not.toBeNull();
    expect(snap.viewer.player?.canSubmitNow).toBe(true);
    expect(snap.viewer.player?.myAnswerThisRound).toBeNull();
  });

  it("returns empty timeline for a fresh match", () => {
    const match = makeMatch();
    const snap = buildSnapshot(match, { role: "PUBLIC", userId: null });

    expect(snap.timeline).toEqual([]);
  });

  it("computes nextQuestionIndex correctly", () => {
    const match = makeMatch({
      status: "LIVE",
      currentRound: 3,
      rounds: [],
    });
    const snap = buildSnapshot(match, { role: "PUBLIC", userId: null });

    expect(snap.nextQuestionIndex).toBe(4);
  });

  it("hides nextQuestionIndex when round is open", () => {
    const match = makeMatch({
      status: "LIVE",
      currentRound: 3,
      rounds: [
        {
          number: 4,
          status: "OPEN",
          closesAt: new Date(Date.now() + 30000),
          questionId: "q4",
          decision: null,
          goalSubmissionId: null,
          openedAt: new Date(),
          lockedAt: null,
          decidedAt: null,
          question: { id: "q4", text: "Q4", referenceAnswer: "A4" },
          submissions: [],
          goalSubmission: null,
        },
      ] as any,
    });
    const snap = buildSnapshot(match, { role: "PUBLIC", userId: null });

    expect(snap.nextQuestionIndex).toBeNull();
  });
});
