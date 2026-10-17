import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

/** Loosely-typed view of a mocked model method (fixtures are partial rows). */
const mockFn = (fn: unknown): Mock => fn as Mock;

const h = vi.hoisted(() => {
  const tx = {
    match: {
      update: vi.fn().mockResolvedValue({ version: 2 }),
      create: vi.fn().mockResolvedValue({ id: "newmatch" }),
    },
    matchPlayer: {
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    question: {
      create: vi.fn().mockResolvedValue({ id: "qnew" }),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    round: {
      create: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    teamPlayer: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    team: {
      findUnique: vi.fn().mockResolvedValue({ members: [] }),
    },
  };
  return { tx };
});

vi.mock("@/lib/prisma", () => ({
  TX_OPTS: { timeout: 30_000, maxWait: 10_000 },
  prisma: {
    match: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    matchPlayer: { create: vi.fn(), delete: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    question: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    round: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn(), upsert: vi.fn() },
    submission: { create: vi.fn(), count: vi.fn() },
    timelineEvent: { create: vi.fn(), count: vi.fn(), deleteMany: vi.fn() },
    substitutionRequest: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    substitution: { create: vi.fn() },
    conductIncident: { create: vi.fn() },
    fantasyEntry: { updateMany: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(h.tx)),
  },
}));

vi.mock("@/lib/matchCode", () => ({
  generateMatchCode: vi.fn(() => "AB12CD"),
}));

vi.mock("@/lib/realtime/server", () => ({
  publishMatchUpdate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/platform/engine", () => ({
  GOAL_POINTS: 3,
}));

import { prisma } from "@/lib/prisma";
import {
  autoCompleteSetup,
  bulkAddPlayers,
  importQuestions,
  rematch,
  type Actor,
} from "@/lib/match/engine";

const ADMIN: Actor = { userId: "admin1", role: "ADMIN" };
const REFEREE: Actor = { userId: "ref1", role: "REFEREE" };

type RosterRow = {
  id: string;
  userId: string;
  team: "HOME" | "AWAY";
  number: number;
  role: "STARTER" | "SUB" | "OUT";
  isCaptain: boolean;
  user: { id: string; name: string };
};

function rosterRows(team: "HOME" | "AWAY", size: number, captain?: number): RosterRow[] {
  return Array.from({ length: size }, (_, i) => {
    const number = i + 1;
    return {
      id: `${team.toLowerCase()}-slot-${number}`,
      userId: `${team.toLowerCase()}-p${number}`,
      team,
      number,
      role: "STARTER" as const,
      isCaptain: captain === number,
      user: { id: `${team.toLowerCase()}-p${number}`, name: `${team} Player ${number}` },
    };
  });
}

function mockMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: "match1",
    code: "AB12CD",
    status: "DRAFT",
    homeName: "Home FC",
    awayName: "Away United",
    homeTeamId: null,
    awayTeamId: null,
    refereeId: "ref1",
    countdownSeconds: 15,
    roster: [],
    rounds: [],
    questions: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("autoCompleteSetup", () => {
  it("trims starters to the first five, keeps captains and fills bank questions into empty slots", async () => {
    const roster = [...rosterRows("HOME", 8, 4), ...rosterRows("AWAY", 7, 2)];
    const rounds = [
      { id: "r1", number: 1, status: "PENDING", questionId: "q1" },
      { id: "r2", number: 2, status: "PENDING", questionId: "q2" },
    ];
    const questions = [
      { id: "q1", order: 1, text: "Slotted one", referenceAnswer: "a", roundNumber: 1 },
      { id: "q2", order: 2, text: "Slotted two", referenceAnswer: "b", roundNumber: 2 },
      { id: "q3", order: 3, text: "Bank one", referenceAnswer: "c", roundNumber: null },
      { id: "q4", order: 4, text: "Bank two", referenceAnswer: "d", roundNumber: null },
      { id: "q5", order: 5, text: "Bank three", referenceAnswer: "e", roundNumber: null },
      { id: "q6", order: 6, text: "Bank four", referenceAnswer: "f", roundNumber: null },
    ];
    mockFn(prisma.match.findUnique).mockResolvedValue(mockMatch({ roster, rounds, questions }));

    const result = await autoCompleteSetup(REFEREE, { code: "AB12CD" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.starters).toBe(10);
      expect(result.data.captains).toBe(2);
      expect(result.data.slotsFilled).toBe(4);
      expect(result.data.sidesSkipped).toEqual([]);
    }
    expect(h.tx.matchPlayer.update).toHaveBeenCalledTimes(15);
    // Home captain (number 4) stays captain; away captain (number 2) too.
    expect(h.tx.matchPlayer.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "home-slot-4" }, data: expect.objectContaining({ isCaptain: true, role: "STARTER" }) }),
    );
    expect(h.tx.matchPlayer.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "home-slot-6" }, data: expect.objectContaining({ role: "SUB" }) }),
    );
    // First four empty slots 3..6 get the four bank questions.
    expect(h.tx.round.create).toHaveBeenCalledTimes(4);
    expect(h.tx.round.create).toHaveBeenCalledWith({ data: { matchId: "match1", number: 3, questionId: "q3" } });
    expect(h.tx.round.create).toHaveBeenCalledWith({ data: { matchId: "match1", number: 6, questionId: "q6" } });
  });

  it("skips sides with fewer than five players", async () => {
    const roster = [...rosterRows("HOME", 5, 1), ...rosterRows("AWAY", 3)];
    mockFn(prisma.match.findUnique).mockResolvedValue(mockMatch({ roster }));

    const result = await autoCompleteSetup(ADMIN, { code: "AB12CD" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.starters).toBe(5);
      expect(result.data.sidesSkipped).toEqual(["Away United"]);
    }
  });

  it("rejects when nothing can be filled", async () => {
    mockFn(prisma.match.findUnique).mockResolvedValue(mockMatch({ roster: rosterRows("HOME", 3) }));

    const result = await autoCompleteSetup(ADMIN, { code: "AB12CD" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Nothing to auto-fill");
  });

  it("rejects non-draft matches", async () => {
    mockFn(prisma.match.findUnique).mockResolvedValue(mockMatch({ status: "LIVE" }));

    const result = await autoCompleteSetup(REFEREE, { code: "AB12CD" });

    expect(result.ok).toBe(false);
  });
});

describe("importQuestions", () => {
  it("skips duplicates and slots new questions into open slots", async () => {
    const target = mockMatch({
      questions: [{ id: "q1", order: 1, text: "What is 2+2?", referenceAnswer: "4", roundNumber: 1 }],
      rounds: [{ id: "r1", number: 1, status: "PENDING", questionId: "q1" }],
    });
    const source = mockMatch({
      id: "match2",
      code: "ZZ99YY",
      questions: [
        { id: "sq1", order: 1, text: "What is 2+2?", referenceAnswer: "4", roundNumber: null },
        { id: "sq2", order: 2, text: "Who wrote Things Fall Apart?", referenceAnswer: "Chinua Achebe", roundNumber: null },
      ],
    });
    mockFn(prisma.match.findUnique).mockResolvedValueOnce(target).mockResolvedValueOnce(source);

    const result = await importQuestions(ADMIN, { code: "AB12CD", sourceCode: "ZZ99YY" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ added: 1, skipped: 1, slotsFilled: 1 });
    }
    expect(h.tx.question.create).toHaveBeenCalledTimes(1);
    expect(h.tx.question.create).toHaveBeenCalledWith({
      data: { matchId: "match1", order: 2, text: "Who wrote Things Fall Apart?", referenceAnswer: "Chinua Achebe" },
    });
    expect(h.tx.round.create).toHaveBeenCalledWith({ data: { matchId: "match1", number: 2, questionId: "qnew" } });
  });

  it("rejects when the bank is already full", async () => {
    const target = mockMatch({
      questions: Array.from({ length: 20 }, (_, i) => ({ id: `q${i}`, order: i + 1, text: `Q${i}`, referenceAnswer: "a", roundNumber: null })),
    });
    const source = mockMatch({ id: "match2", code: "ZZ99YY", questions: [{ id: "sq1", order: 1, text: "Fresh one", referenceAnswer: "x", roundNumber: null }] });
    mockFn(prisma.match.findUnique).mockResolvedValueOnce(target).mockResolvedValueOnce(source);

    const result = await importQuestions(ADMIN, { code: "AB12CD", sourceCode: "ZZ99YY" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("full bank");
  });

  it("rejects importing from itself", async () => {
    const target = mockMatch({});
    mockFn(prisma.match.findUnique).mockResolvedValueOnce(target).mockResolvedValueOnce(target);

    const result = await importQuestions(ADMIN, { code: "AB12CD", sourceCode: "AB12CD" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("different match");
  });
});

describe("bulkAddPlayers", () => {
  it("adds players with the next free shirt numbers in order", async () => {
    mockFn(prisma.match.findUnique).mockResolvedValue(mockMatch({ roster: rosterRows("HOME", 2, 1) }));
    mockFn(prisma.user.findMany).mockResolvedValue([
      { id: "p1", role: "PLAYER" },
      { id: "p2", role: "PLAYER" },
      { id: "p3", role: "PLAYER" },
    ]);

    const result = await bulkAddPlayers(ADMIN, { code: "AB12CD", team: "HOME", userIds: ["p1", "p2", "p3"] });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.added).toBe(3);
    expect(h.tx.matchPlayer.create).toHaveBeenNthCalledWith(1, { data: { matchId: "match1", userId: "p1", team: "HOME", number: 3 } });
    expect(h.tx.matchPlayer.create).toHaveBeenNthCalledWith(3, { data: { matchId: "match1", userId: "p3", team: "HOME", number: 5 } });
  });

  it("rejects when more players are selected than free shirts", async () => {
    mockFn(prisma.match.findUnique).mockResolvedValue(mockMatch({ roster: rosterRows("HOME", 7) }));

    const result = await bulkAddPlayers(ADMIN, { code: "AB12CD", team: "HOME", userIds: ["a", "b", "c"] });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Only 1 shirt");
  });

  it("only adds player accounts not already in the match", async () => {
    mockFn(prisma.match.findUnique).mockResolvedValue(mockMatch({ roster: rosterRows("HOME", 0) }));
    mockFn(prisma.user.findMany).mockResolvedValue([
      { id: "p1", role: "PLAYER" },
      { id: "ref1", role: "REFEREE" },
    ]);

    const result = await bulkAddPlayers(ADMIN, { code: "AB12CD", team: "HOME", userIds: ["p1", "ref1"] });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.added).toBe(1);
  });

  it("rejects non-admins", async () => {
    const result = await bulkAddPlayers(REFEREE, { code: "AB12CD", team: "HOME", userIds: ["p1"] });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("admin");
  });
});

describe("rematch", () => {
  it("clones team-backed matches with fresh rosters", async () => {
    mockFn(prisma.match.findUnique).mockResolvedValue(
      mockMatch({ homeTeamId: "t1", awayTeamId: "t2", homeName: "Home FC", awayName: "Away United" }),
    );
    h.tx.team.findUnique.mockResolvedValue({ members: [{ userId: "u1", number: 1, isCaptain: true }] });

    const result = await rematch(ADMIN, { code: "AB12CD" });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.code).toBe("AB12CD");
    expect(h.tx.match.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ homeTeamId: "t1", awayTeamId: "t2", refereeId: "ref1" }),
      }),
    );
    expect(h.tx.matchPlayer.create).toHaveBeenCalledTimes(2);
  });

  it("clones name-only matches without rosters", async () => {
    mockFn(prisma.match.findUnique).mockResolvedValue(mockMatch({}));

    const result = await rematch(ADMIN, { code: "AB12CD" });

    expect(result.ok).toBe(true);
    expect(h.tx.matchPlayer.create).not.toHaveBeenCalled();
  });

  it("rejects non-admins", async () => {
    const result = await rematch(REFEREE, { code: "AB12CD" });
    expect(result.ok).toBe(false);
  });
});
