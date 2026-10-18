import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

/** Loosely-typed view of a mocked model method (fixtures are partial rows). */
const mockFn = (fn: unknown): Mock => fn as Mock;

const h = vi.hoisted(() => {
  const tx = {
    match: { update: vi.fn().mockResolvedValue({ version: 2 }) },
    matchPlayer: { update: vi.fn().mockResolvedValue({}) },
    integrityFlag: { update: vi.fn().mockResolvedValue({}) },
    conductIncident: { create: vi.fn().mockResolvedValue({}) },
    timelineEvent: { count: vi.fn().mockResolvedValue(0), create: vi.fn().mockResolvedValue({}) },
  };
  return { tx };
});

vi.mock("@/lib/prisma", () => ({
  TX_OPTS: { timeout: 30_000, maxWait: 10_000 },
  prisma: {
    match: { findUnique: vi.fn(), update: vi.fn() },
    matchPlayer: { update: vi.fn() },
    substitutionRequest: { findFirst: vi.fn(), create: vi.fn() },
    integrityFlag: { update: vi.fn() },
    matchPresence: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
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
  ignoreIntegrityFlag,
  issueIntegrityAction,
  requestSubstitution,
  syncMatchState,
  runGuarded,
  type Actor,
} from "@/lib/match/engine";

const REFEREE: Actor = { userId: "ref1", role: "REFEREE" };
const PLAYER: Actor = { userId: "p1", role: "PLAYER" };

function slot(
  id: string,
  userId: string,
  team: "HOME" | "AWAY",
  role: "STARTER" | "SUB" | "OUT",
  number: number,
  isCaptain = false,
) {
  return { id, userId, team, role, number, isCaptain, user: { id: userId, name: `Player ${number}` } };
}

function mockMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: "match1",
    code: "AB12CD",
    status: "DRAFT",
    pausedAt: null,
    refereeId: "ref1",
    roster: [],
    rounds: [],
    integrityFlags: [],
    ...overrides,
  };
}

function flagRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "f1",
    playerId: "home1",
    kind: "COPIED_ANSWER",
    seq: 1,
    suggested: "WARNING",
    action: null,
    ignoredAt: null,
    detail: null,
    round: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requestSubstitution", () => {
  const liveMatch = () =>
    mockMatch({
      status: "LIVE",
      roster: [
        slot("cap1", "p1", "HOME", "STARTER", 1, true),
        slot("out1", "p2", "HOME", "STARTER", 2),
        slot("in1", "p3", "HOME", "SUB", 6),
      ],
    });

  it("sends the first request through", async () => {
    mockFn(prisma.match.findUnique).mockResolvedValue(liveMatch());
    mockFn(prisma.substitutionRequest.findFirst).mockResolvedValue(null);

    const result = await requestSubstitution(PLAYER, {
      code: "AB12CD",
      playerOutUserId: "p2",
      playerInUserId: "p3",
    });

    expect(result.ok).toBe(true);
    expect(prisma.substitutionRequest.findFirst).toHaveBeenCalledWith({
      where: { matchId: "match1", team: "HOME", status: "PENDING" },
      select: { id: true },
    });
    expect(prisma.substitutionRequest.create).toHaveBeenCalledTimes(1);
  });

  it("refuses a second request while one is still pending", async () => {
    mockFn(prisma.match.findUnique).mockResolvedValue(liveMatch());
    mockFn(prisma.substitutionRequest.findFirst).mockResolvedValue({ id: "req1" });

    const result = await requestSubstitution(PLAYER, {
      code: "AB12CD",
      playerOutUserId: "p2",
      playerInUserId: "p3",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("already sent");
    expect(prisma.substitutionRequest.create).not.toHaveBeenCalled();
  });
});

describe("ignoreIntegrityFlag", () => {
  const flaggedMatch = () =>
    mockMatch({
      integrityFlags: [flagRow()],
      roster: [slot("home1", "p2", "HOME", "STARTER", 2)],
    });

  it("ignores a pending breach without touching the score", async () => {
    mockFn(prisma.match.findUnique).mockResolvedValue(flaggedMatch());
    mockFn(prisma.integrityFlag.update).mockResolvedValue({});

    const result = await ignoreIntegrityFlag(REFEREE, { code: "AB12CD", flagId: "f1" });

    expect(result.ok).toBe(true);
    expect(prisma.integrityFlag.update).toHaveBeenCalledWith({
      where: { id: "f1" },
      data: { ignoredById: "ref1", ignoredAt: expect.any(Date) },
    });
    expect(prisma.matchPlayer.update).not.toHaveBeenCalled();
    expect(h.tx.matchPlayer.update).not.toHaveBeenCalled();
  });

  it("refuses to ignore a breach that already has a card", async () => {
    mockFn(prisma.match.findUnique).mockResolvedValue(
      mockMatch({ integrityFlags: [flagRow({ action: "YELLOW_CARD" })] }),
    );

    const result = await ignoreIntegrityFlag(REFEREE, { code: "AB12CD", flagId: "f1" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("already been issued");
  });

  it("is referee/admin only", async () => {
    mockFn(prisma.match.findUnique).mockResolvedValue(flaggedMatch());

    const result = await runGuarded(() =>
      ignoreIntegrityFlag(PLAYER, { code: "AB12CD", flagId: "f1" }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("referee");
  });
});

describe("issueIntegrityAction", () => {
  const flaggedMatch = () =>
    mockMatch({
      status: "LIVE",
      integrityFlags: [flagRow()],
      roster: [slot("home1", "p2", "HOME", "STARTER", 2)],
    });

  it("counts the breach: books the card and deducts the penalty", async () => {
    mockFn(prisma.match.findUnique).mockResolvedValue(flaggedMatch());

    const result = await issueIntegrityAction(REFEREE, {
      code: "AB12CD",
      flagId: "f1",
      action: "YELLOW_CARD",
    });

    expect(result.ok).toBe(true);
    expect(h.tx.matchPlayer.update).toHaveBeenCalledWith({
      where: { id: "home1" },
      data: { integrityScore: { decrement: 10 } },
    });
    expect(h.tx.integrityFlag.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "YELLOW_CARD", issuedById: "ref1" }),
      }),
    );
  });

  it("sends a red-carded player off and deducts the red penalty", async () => {
    mockFn(prisma.match.findUnique).mockResolvedValue(flaggedMatch());

    const result = await issueIntegrityAction(REFEREE, {
      code: "AB12CD",
      flagId: "f1",
      action: "RED_CARD",
    });

    expect(result.ok).toBe(true);
    expect(h.tx.matchPlayer.update).toHaveBeenCalledWith({
      where: { id: "home1" },
      data: { integrityScore: { decrement: 15 }, role: "OUT" },
    });
  });

  it("refuses to count an ignored breach", async () => {
    mockFn(prisma.match.findUnique).mockResolvedValue(
      mockMatch({ integrityFlags: [flagRow({ ignoredAt: new Date() })] }),
    );

    const result = await issueIntegrityAction(REFEREE, {
      code: "AB12CD",
      flagId: "f1",
      action: "WARNING",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("ignored");
  });
});

describe("presence heartbeat", () => {
  it("records the viewer's presence on a sync", async () => {
    mockFn(prisma.match.findUnique).mockResolvedValue(mockMatch());
    mockFn(prisma.matchPresence.findUnique).mockResolvedValue(null);
    mockFn(prisma.matchPresence.create).mockResolvedValue({});

    await syncMatchState("AB12CD", "u1");

    expect(prisma.matchPresence.create).toHaveBeenCalledWith({
      data: { matchId: "match1", userId: "u1", lastSeenAt: expect.any(Date) },
    });
  });

  it("throttles a fresh presence row", async () => {
    mockFn(prisma.match.findUnique).mockResolvedValue(mockMatch());
    mockFn(prisma.matchPresence.findUnique).mockResolvedValue({ lastSeenAt: new Date() });

    await syncMatchState("AB12CD", "u1");

    expect(prisma.matchPresence.update).not.toHaveBeenCalled();
    expect(prisma.matchPresence.create).not.toHaveBeenCalled();
  });

  it("refreshes a stale presence row", async () => {
    mockFn(prisma.match.findUnique).mockResolvedValue(mockMatch());
    mockFn(prisma.matchPresence.findUnique).mockResolvedValue({
      lastSeenAt: new Date(Date.now() - 60_000),
    });

    await syncMatchState("AB12CD", "u1");

    expect(prisma.matchPresence.update).toHaveBeenCalledWith({
      where: { matchId_userId: { matchId: "match1", userId: "u1" } },
      data: { lastSeenAt: expect.any(Date) },
    });
  });

  it("anonymous syncs record nothing", async () => {
    mockFn(prisma.match.findUnique).mockResolvedValue(mockMatch());

    await syncMatchState("AB12CD");

    expect(prisma.matchPresence.findUnique).not.toHaveBeenCalled();
    expect(prisma.matchPresence.create).not.toHaveBeenCalled();
  });
});
