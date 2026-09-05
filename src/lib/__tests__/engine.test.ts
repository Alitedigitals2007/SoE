import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    match: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    matchPlayer: {
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    question: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    round: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
    },
    submission: {
      create: vi.fn(),
      count: vi.fn(),
    },
    timelineEvent: {
      count: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    substitutionRequest: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    substitution: {
      create: vi.fn(),
    },
    conductIncident: {
      create: vi.fn(),
    },
    fantasyEntry: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => {
      const tx = {
        match: {
          update: vi.fn().mockResolvedValue({ version: 1 }),
          findUnique: vi.fn().mockResolvedValue({ version: 1 }),
        },
        round: {
          update: vi.fn().mockResolvedValue({}),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          delete: vi.fn().mockResolvedValue({}),
          upsert: vi.fn().mockResolvedValue({}),
          findUnique: vi.fn().mockResolvedValue(null),
          deleteMany: vi.fn().mockResolvedValue({}),
          count: vi.fn().mockResolvedValue(0),
        },
        submission: {
          create: vi.fn().mockResolvedValue({}),
          count: vi.fn().mockResolvedValue(0),
        },
        timelineEvent: {
          count: vi.fn().mockResolvedValue(0),
          create: vi.fn().mockResolvedValue({}),
          deleteMany: vi.fn().mockResolvedValue({}),
        },
        matchPlayer: {
          update: vi.fn().mockResolvedValue({}),
          findUnique: vi.fn().mockResolvedValue(null),
        },
        question: {
          update: vi.fn().mockResolvedValue({}),
          delete: vi.fn().mockResolvedValue({}),
        },
        substitutionRequest: {
          update: vi.fn().mockResolvedValue({}),
        },
        substitution: {
          create: vi.fn().mockResolvedValue({}),
        },
        conductIncident: {
          create: vi.fn().mockResolvedValue({}),
        },
        fantasyEntry: {
          updateMany: vi.fn().mockResolvedValue({}),
        },
      };
      return fn(tx);
    }),
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
  adminCreateMatch,
  adminAddPlayer,
  adminRemovePlayer,
  addQuestion,
  kickOff,
  openNextQuestion,
  submitAnswer,
  decideRound,
  endMatch,
  syncMatchState,
  MatchGuardError,
  runGuarded,
  type Actor,
} from "@/lib/match/engine";

const ADMIN: Actor = { userId: "admin1", role: "ADMIN" };
const REFEREE: Actor = { userId: "ref1", role: "REFEREE" };
const PLAYER: Actor = { userId: "p1", role: "PLAYER" };
const USER: Actor = { userId: "u1", role: "USER" };

function mockMatch(overrides: Record<string, any> = {}) {
  return {
    id: "match1",
    code: "AB12CD",
    status: "DRAFT",
    homeName: "Home FC",
    awayName: "Away United",
    homeScore: 0,
    awayScore: 0,
    version: 1,
    countdownSeconds: 15,
    currentRound: 0,
    startedAt: null,
    finishedAt: null,
    refereeId: "ref1",
    competitionId: null,
    referee: { id: "ref1", name: "Ref One" },
    roster: [],
    rounds: [],
    timeline: [],
    questions: [],
    _count: { roster: 0 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("adminCreateMatch", () => {
  it("creates a match as admin", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "ref1", role: "REFEREE" });
    (prisma.match.create as any).mockResolvedValue({});

    const result = await adminCreateMatch(ADMIN, {
      homeName: "Home FC",
      awayName: "Away United",
      refereeId: "ref1",
      countdownSeconds: 15,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.code).toBe("AB12CD");
    }
  });

  it("rejects non-admin actors", async () => {
    const result = await adminCreateMatch(REFEREE, {
      homeName: "Home FC",
      awayName: "Away United",
      refereeId: "ref1",
      countdownSeconds: 15,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("admin");
    }
  });

  it("rejects when referee not found", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    const result = await adminCreateMatch(ADMIN, {
      homeName: "Home FC",
      awayName: "Away United",
      refereeId: "nonexistent",
      countdownSeconds: 15,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("referee");
    }
  });

  it("rejects empty team names", async () => {
    const result = await adminCreateMatch(ADMIN, {
      homeName: "",
      awayName: "Away United",
      refereeId: "ref1",
      countdownSeconds: 15,
    });

    expect(result.ok).toBe(false);
  });
});

describe("adminAddPlayer", () => {
  it("adds a player to a draft match", async () => {
    const match = mockMatch();
    (prisma.match.findUnique as any).mockResolvedValue(match);
    (prisma.user.findUnique as any).mockResolvedValue({ id: "p1", role: "PLAYER" });
    (prisma.matchPlayer.create as any).mockResolvedValue({});

    const result = await adminAddPlayer(ADMIN, {
      code: "AB12CD",
      userId: "p1",
      team: "HOME",
      number: 1,
    });

    expect(result.ok).toBe(true);
  });

  it("rejects when match is not DRAFT", async () => {
    const match = mockMatch({ status: "LIVE" });
    (prisma.match.findUnique as any).mockResolvedValue(match);

    const result = await adminAddPlayer(ADMIN, {
      code: "AB12CD",
      userId: "p1",
      team: "HOME",
      number: 1,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("locked");
    }
  });

  it("rejects duplicate player", async () => {
    const match = mockMatch({
      roster: [{ userId: "p1", team: "HOME", number: 1 }],
    });
    (prisma.match.findUnique as any).mockResolvedValue(match);
    (prisma.user.findUnique as any).mockResolvedValue({ id: "p1", role: "PLAYER" });

    const result = await adminAddPlayer(ADMIN, {
      code: "AB12CD",
      userId: "p1",
      team: "HOME",
      number: 2,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("already");
    }
  });

  it("rejects out-of-range shirt numbers", async () => {
    const match = mockMatch();
    (prisma.match.findUnique as any).mockResolvedValue(match);
    (prisma.user.findUnique as any).mockResolvedValue({ id: "p1", role: "PLAYER" });

    const result = await adminAddPlayer(ADMIN, {
      code: "AB12CD",
      userId: "p1",
      team: "HOME",
      number: 9,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("1 to 8");
    }
  });
});

describe("adminRemovePlayer", () => {
  it("removes a player from a draft match", async () => {
    const match = mockMatch({
      roster: [{ id: "slot1", userId: "p1", team: "HOME", number: 1 }],
      rounds: [],
    });
    (prisma.match.findUnique as any).mockResolvedValue(match);
    (prisma.matchPlayer.delete as any).mockResolvedValue({});

    const result = await adminRemovePlayer(ADMIN, {
      code: "AB12CD",
      userId: "p1",
    });

    expect(result.ok).toBe(true);
  });

  it("rejects when match is not DRAFT", async () => {
    const match = mockMatch({ status: "LIVE" });
    (prisma.match.findUnique as any).mockResolvedValue(match);

    const result = await adminRemovePlayer(ADMIN, {
      code: "AB12CD",
      userId: "p1",
    });

    expect(result.ok).toBe(false);
  });
});

describe("addQuestion", () => {
  it("adds a question as referee", async () => {
    const match = mockMatch({ questions: [] });
    (prisma.match.findUnique as any).mockResolvedValue(match);
    (prisma.question.create as any).mockResolvedValue({});

    const result = await addQuestion(REFEREE, {
      code: "AB12CD",
      text: "What is 2+2?",
      referenceAnswer: "4",
    });

    expect(result.ok).toBe(true);
  });

  it("rejects non-referee actors", async () => {
    const match = mockMatch();
    (prisma.match.findUnique as any).mockResolvedValue(match);

    await expect(
      addQuestion(PLAYER, {
        code: "AB12CD",
        text: "What is 2+2?",
        referenceAnswer: "4",
      }),
    ).rejects.toThrow();
  });

  it("rejects when match is not DRAFT", async () => {
    const match = mockMatch({ status: "LIVE" });
    (prisma.match.findUnique as any).mockResolvedValue(match);

    const result = await addQuestion(REFEREE, {
      code: "AB12CD",
      text: "What is 2+2?",
      referenceAnswer: "4",
    });

    expect(result.ok).toBe(false);
  });

  it("rejects when 20 questions already exist", async () => {
    const match = mockMatch({
      questions: Array.from({ length: 20 }, (_, i) => ({ id: `q${i}`, order: i + 1 })),
    });
    (prisma.match.findUnique as any).mockResolvedValue(match);

    const result = await addQuestion(REFEREE, {
      code: "AB12CD",
      text: "What is 2+2?",
      referenceAnswer: "4",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("20");
    }
  });
});

describe("kickOff", () => {
  it("starts a match with valid setup", async () => {
    const rounds = Array.from({ length: 10 }, (_, i) => ({
      number: i + 1,
      status: "PENDING" as const,
      questionId: `q${i}`,
      question: { id: `q${i}`, text: `Q${i + 1}`, referenceAnswer: `A${i + 1}` },
    }));
    const roster = [
      ...Array.from({ length: 5 }, (_, i) => ({
        userId: `home${i}`,
        team: "HOME" as const,
        role: "STARTER" as const,
        isCaptain: i === 0,
        number: i + 1,
        user: { id: `home${i}`, name: `Home Player ${i}` },
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        userId: `away${i}`,
        team: "AWAY" as const,
        role: "STARTER" as const,
        isCaptain: i === 0,
        number: i + 1,
        user: { id: `away${i}`, name: `Away Player ${i}` },
      })),
    ];
    const match = mockMatch({ rounds, roster });
    (prisma.match.findUnique as any).mockResolvedValue(match);

    const result = await kickOff(REFEREE, { code: "AB12CD" });
    expect(result.ok).toBe(true);
  });

  it("rejects if match already started", async () => {
    const match = mockMatch({ status: "LIVE" });
    (prisma.match.findUnique as any).mockResolvedValue(match);

    const result = await kickOff(REFEREE, { code: "AB12CD" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("already started");
    }
  });

  it("rejects when missing question slots", async () => {
    const rounds = [
      { number: 1, status: "PENDING" as const, questionId: "q0", question: { id: "q0", text: "Q1", referenceAnswer: "A1" } },
    ];
    const roster = [
      ...Array.from({ length: 5 }, (_, i) => ({
        userId: `home${i}`,
        team: "HOME" as const,
        role: "STARTER" as const,
        isCaptain: i === 0,
        number: i + 1,
        user: { id: `home${i}`, name: `Home ${i}` },
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        userId: `away${i}`,
        team: "AWAY" as const,
        role: "STARTER" as const,
        isCaptain: i === 0,
        number: i + 1,
        user: { id: `away${i}`, name: `Away ${i}` },
      })),
    ];
    const match = mockMatch({ rounds, roster });
    (prisma.match.findUnique as any).mockResolvedValue(match);

    const result = await kickOff(REFEREE, { code: "AB12CD" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("missing");
    }
  });
});

describe("submitAnswer", () => {
  it("submits an answer as a starter", async () => {
    const match = mockMatch({
      status: "LIVE",
      rounds: [
        {
          number: 1,
          status: "OPEN",
          closesAt: new Date(Date.now() + 60000),
          submissions: [],
          question: { text: "Q1", referenceAnswer: "A1" },
        },
      ],
      roster: [
        { id: "slot1", userId: "p1", team: "HOME", role: "STARTER", isCaptain: false, number: 1, user: { id: "p1", name: "Player 1" } },
      ],
    });
    (prisma.match.findUnique as any).mockResolvedValue(match);

    const result = await submitAnswer(PLAYER, {
      code: "AB12CD",
      answer: "Paris",
    });

    expect(result.ok).toBe(true);
  });

  it("rejects when match is not LIVE", async () => {
    const match = mockMatch({ status: "DRAFT" });
    (prisma.match.findUnique as any).mockResolvedValue(match);

    const result = await submitAnswer(PLAYER, {
      code: "AB12CD",
      answer: "Paris",
    });

    expect(result.ok).toBe(false);
  });

  it("rejects non-player actors", async () => {
    const match = mockMatch({
      status: "LIVE",
      rounds: [
        { number: 1, status: "OPEN", closesAt: new Date(Date.now() + 60000), submissions: [] },
      ],
      roster: [],
    });
    (prisma.match.findUnique as any).mockResolvedValue(match);

    const result = await submitAnswer(REFEREE, {
      code: "AB12CD",
      answer: "Paris",
    });

    expect(result.ok).toBe(false);
  });

  it("rejects empty answers", async () => {
    const match = mockMatch({
      status: "LIVE",
      rounds: [
        { number: 1, status: "OPEN", closesAt: new Date(Date.now() + 60000), submissions: [] },
      ],
      roster: [
        { id: "slot1", userId: "p1", team: "HOME", role: "STARTER", isCaptain: false, number: 1, user: { id: "p1", name: "Player 1" } },
      ],
    });
    (prisma.match.findUnique as any).mockResolvedValue(match);

    const result = await submitAnswer(PLAYER, {
      code: "AB12CD",
      answer: "  ",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("empty");
    }
  });

  it("rejects duplicate submissions", async () => {
    const match = mockMatch({
      status: "LIVE",
      rounds: [
        {
          number: 1,
          status: "OPEN",
          closesAt: new Date(Date.now() + 60000),
          submissions: [{ playerId: "slot1" }],
        },
      ],
      roster: [
        { id: "slot1", userId: "p1", team: "HOME", role: "STARTER", isCaptain: false, number: 1, user: { id: "p1", name: "Player 1" } },
      ],
    });
    (prisma.match.findUnique as any).mockResolvedValue(match);

    const result = await submitAnswer(PLAYER, {
      code: "AB12CD",
      answer: "Paris",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("already answered");
    }
  });
});

describe("decideRound", () => {
  it("decides NO_GOAL", async () => {
    const match = mockMatch({
      rounds: [
        {
          number: 1,
          status: "LOCKED",
          submissions: [],
          question: { text: "Q1", referenceAnswer: "A1" },
        },
      ],
    });
    (prisma.match.findUnique as any).mockResolvedValue(match);

    const result = await decideRound(REFEREE, {
      code: "AB12CD",
      decision: "NO_GOAL",
    });

    expect(result.ok).toBe(true);
  });

  it("rejects when no locked round", async () => {
    const match = mockMatch({ rounds: [] });
    (prisma.match.findUnique as any).mockResolvedValue(match);

    const result = await decideRound(REFEREE, {
      code: "AB12CD",
      decision: "NO_GOAL",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("locked");
    }
  });
});

describe("endMatch", () => {
  it("ends a live match at round 10", async () => {
    const match = mockMatch({ status: "LIVE", currentRound: 10 });
    (prisma.match.findUnique as any).mockResolvedValue(match);

    const result = await endMatch(REFEREE, { code: "AB12CD" });
    expect(result.ok).toBe(true);
  });

  it("rejects when not all rounds played", async () => {
    const match = mockMatch({ status: "LIVE", currentRound: 5 });
    (prisma.match.findUnique as any).mockResolvedValue(match);

    const result = await endMatch(REFEREE, { code: "AB12CD" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("ten questions");
    }
  });

  it("rejects when match is not live", async () => {
    const match = mockMatch({ status: "DRAFT" });
    (prisma.match.findUnique as any).mockResolvedValue(match);

    const result = await endMatch(REFEREE, { code: "AB12CD" });
    expect(result.ok).toBe(false);
  });
});

describe("syncMatchState", () => {
  it("returns version for existing match", async () => {
    const match = mockMatch({ rounds: [] });
    (prisma.match.findUnique as any)
      .mockResolvedValueOnce(match)
      .mockResolvedValueOnce({ version: 5 });

    const version = await syncMatchState("AB12CD");
    expect(version).toBe(5);
  });

  it("returns null for missing match", async () => {
    (prisma.match.findUnique as any).mockResolvedValue(null);

    const version = await syncMatchState("XXXXXX");
    expect(version).toBeNull();
  });
});

describe("runGuarded", () => {
  it("returns ok result", async () => {
    const result = await runGuarded(async () => "hello");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe("hello");
    }
  });

  it("catches MatchGuardError", async () => {
    const result = await runGuarded(async () => {
      throw new MatchGuardError("Not allowed");
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Not allowed");
    }
  });
});
