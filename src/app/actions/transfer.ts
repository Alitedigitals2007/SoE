"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { currentActor } from "@/lib/session";
import { getOpenTransferWindow } from "@/lib/transferWindow";
import type { ActionResult } from "@/lib/domain";

async function requireActor() {
  const actor = await currentActor();
  if (!actor) return { ok: false as const, error: "Sign in to continue." } as const;
  return { ok: true as const, actor } as const;
}

function ok<T>(data?: T): ActionResult<T> { return { ok: true, data } as ActionResult<T>; }
function err(message: string): ActionResult<never> { return { ok: false, error: message } as ActionResult<never>; }

/* ---------------------------------- captain: request ---------------------------------- */

export async function createTransferRequestAction(input: {
  playerId: string;
  fromTeamId: string;
  toTeamId: string;
}) {
  const res = await requireActor();
  if (!res.ok) return res;
  const { actor } = res;
  if (actor.role !== "PLAYER") return err("Only a team captain can request a transfer.");

  const window = await getOpenTransferWindow();
  if (!window) return err("The transfer window is closed — requests can only be made while a window is open.");

  if (input.fromTeamId === input.toTeamId) return err("Pick a different team to transfer to.");

  const [captainMembership, playerMembership, toTeam] = await Promise.all([
    prisma.teamPlayer.findUnique({
      where: { teamId_userId: { teamId: input.fromTeamId, userId: actor.userId } },
    }),
    prisma.teamPlayer.findUnique({
      where: { teamId_userId: { teamId: input.fromTeamId, userId: input.playerId } },
    }),
    prisma.team.findUnique({ where: { id: input.toTeamId } }),
  ]);

  if (!captainMembership || !captainMembership.isCaptain)
    return err("Only the captain of the player's current team can request a transfer.");
  if (!playerMembership) return err("That player is not on your team.");
  if (!toTeam) return err("Target team not found.");
  if (input.playerId === actor.userId) return err("You cannot transfer yourself.");

  const toMemberCount = await prisma.teamPlayer.count({ where: { teamId: input.toTeamId } });
  if (toMemberCount >= 8) return err(`${toTeam.name} is full (8/8 players).`);

  const existing = await prisma.transferRequest.findFirst({
    where: {
      playerId: input.playerId,
      status: { in: ["PENDING", "ADMIN_APPROVED"] },
    },
  });
  if (existing) return err("That player already has a pending transfer request.");

  try {
    const request = await prisma.transferRequest.create({
      data: {
        captainId: actor.userId,
        playerId: input.playerId,
        fromTeamId: input.fromTeamId,
        toTeamId: input.toTeamId,
        status: "PENDING",
      },
      include: {
        captain: { select: { name: true } },
        player: { select: { name: true } },
        fromTeam: { select: { name: true } },
        toTeam: { select: { name: true } },
      },
    });
    return ok(request);
  } catch (e) {
    console.error(e);
    return err("Could not create transfer request.");
  }
}

/* ---------------------------------- admin: decide ---------------------------------- */

export async function adminDecideTransferRequestAction(input: {
  requestId: string;
  decision: "APPROVE" | "REJECT";
  note?: string;
}) {
  const res = await requireActor();
  if (!res.ok) return res;
  const { actor } = res;
  if (actor.role !== "ADMIN") return err("Only an admin can review transfer requests.");

  const request = await prisma.transferRequest.findUnique({
    where: { id: input.requestId },
    include: { player: { select: { name: true } }, fromTeam: { select: { name: true } }, toTeam: { select: { name: true } } },
  });
  if (!request) return err("Transfer request not found.");
  if (request.status !== "PENDING") return err("This request has already been decided.");

  try {
    const updated = await prisma.transferRequest.update({
      where: { id: input.requestId },
      data: {
        status: input.decision === "APPROVE" ? "ADMIN_APPROVED" : "REJECTED",
        adminNote: input.note ?? null,
        decidedBy: actor.userId,
        decidedAt: new Date(),
      },
    });
    return ok(updated);
  } catch (e) {
    console.error(e);
    return err("Could not decide on the transfer request.");
  }
}

/* ---------------------------------- player: accept/decline ---------------------------------- */

export async function playerDecideTransferRequestAction(input: {
  requestId: string;
  decision: "ACCEPT" | "DECLINE";
}) {
  const res = await requireActor();
  if (!res.ok) return res;
  const { actor } = res;
  if (actor.role !== "PLAYER") return err("Only the player can accept or decline a transfer.");

  const request = await prisma.transferRequest.findUnique({
    where: { id: input.requestId },
  });
  if (!request) return err("Transfer request not found.");
  if (request.playerId !== actor.userId) return err("This transfer request is not for you.");
  if (request.status !== "ADMIN_APPROVED") return err("This request has not been approved by an admin yet.");

  if (input.decision === "DECLINE") {
    try {
      await prisma.transferRequest.update({
        where: { id: input.requestId },
        data: { status: "REJECTED", decidedAt: new Date() },
      });
      return ok({ declined: true });
    } catch (e) {
      console.error(e);
      return err("Could not decline the transfer.");
    }
  }

  // Accept: move the player to the target team (assign an available shirt number).
  const window = await getOpenTransferWindow();
  if (!window) return err("The transfer window is closed — the move can only be completed while a window is open.");

  const toMemberCount = await prisma.teamPlayer.count({ where: { teamId: request.toTeamId } });
  const toTeamName = await prisma.team.findUnique({ where: { id: request.toTeamId }, select: { name: true } });
  if (toMemberCount >= 8) return err(`${toTeamName?.name} is full.`);

  const used = new Set(
    (await prisma.teamPlayer.findMany({ where: { teamId: request.toTeamId }, select: { number: true } })).map((m) => m.number),
  );
  let number = 0;
  for (let n = 1; n <= 8; n++) { if (!used.has(n)) { number = n; break; } }
  if (!number) return err("Target team is full.");

  try {
    await prisma.$transaction(async (tx) => {
      await tx.teamPlayer.delete({ where: { teamId_userId: { teamId: request.fromTeamId, userId: request.playerId } } });
      await tx.teamPlayer.create({
        data: { teamId: request.toTeamId, userId: request.playerId, number },
      });
      await tx.transferRequest.update({
        where: { id: input.requestId },
        data: { status: "PLAYER_ACCEPTED", decidedAt: new Date() },
      });
    });
    return ok({ accepted: true, number });
  } catch (e) {
    console.error(e);
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return err("That shirt number is already taken. Try again.");
    return err("Could not complete the transfer.");
  }
}

/* ---------------------------------- reads ---------------------------------- */

export async function getCaptainTransferRequestsAction() {
  const res = await requireActor();
  if (!res.ok) return res;
  const { actor } = res;
  const rows = await prisma.transferRequest.findMany({
    where: { captainId: actor.userId },
    orderBy: { createdAt: "desc" },
    include: {
      player: { select: { name: true, imageUrl: true } },
      fromTeam: { select: { name: true, code: true } },
      toTeam: { select: { name: true, code: true } },
    },
  });
  return ok(rows);
}

export async function getPlayerTransferRequestsAction() {
  const res = await requireActor();
  if (!res.ok) return res;
  const { actor } = res;
  const rows = await prisma.transferRequest.findMany({
    where: { playerId: actor.userId },
    orderBy: { createdAt: "desc" },
    include: {
      captain: { select: { name: true } },
      fromTeam: { select: { name: true, code: true } },
      toTeam: { select: { name: true, code: true } },
    },
  });
  return ok(rows);
}

export async function getAllTransferRequestsAction() {
  const res = await requireActor();
  if (!res.ok) return res;
  const { actor } = res;
  if (actor.role !== "ADMIN") return err("Only an admin can list all transfer requests.");
  const rows = await prisma.transferRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      captain: { select: { name: true } },
      player: { select: { name: true, imageUrl: true } },
      fromTeam: { select: { name: true, code: true } },
      toTeam: { select: { name: true, code: true } },
      decidedByUser: { select: { name: true } },
    },
  });
  return ok(rows);
}

/* ---------------------------------- reads: teams & members ---------------------------------- */

export async function getMyCaptainTeamsAction() {
  const res = await requireActor();
  if (!res.ok) return res;
  const { actor } = res;
  const memberships = await prisma.teamPlayer.findMany({
    where: { userId: actor.userId, isCaptain: true },
    include: { team: { select: { id: true, name: true, code: true } } },
  });
  return ok(memberships.map((m) => m.team));
}

export async function getTeamMembersAction(teamId: string) {
  const res = await requireActor();
  if (!res.ok) return res;
  const rows = await prisma.teamPlayer.findMany({
    where: { teamId },
    include: { user: { select: { id: true, name: true, imageUrl: true } } },
  });
  return ok(rows.map((r) => r.user));
}
