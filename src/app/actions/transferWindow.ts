"use server";

import { prisma } from "@/lib/prisma";
import { currentActor } from "@/lib/session";
import type { ActionResult } from "@/lib/domain";
import { getOpenTransferWindow } from "@/lib/transferWindow";

function ok<T>(data?: T): ActionResult<T> { return { ok: true, data } as ActionResult<T>; }
function err(message: string): ActionResult<never> { return { ok: false, error: message } as ActionResult<never>; }

async function requireAdmin() {
  const actor = await currentActor();
  if (!actor) return { ok: false as const, error: "Sign in to continue." } as const;
  if (actor.role !== "ADMIN") return { ok: false as const, error: "Only an admin can manage transfer windows." } as const;
  return { ok: true as const, actor } as const;
}

function parseDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/* ---------------------------------- reads ---------------------------------- */

export async function getTransferWindowsAction() {
  const res = await requireAdmin();
  if (!res.ok) return res;

  const [windows, active] = await Promise.all([
    prisma.transferWindow.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { listings: true } } },
    }),
    getOpenTransferWindow(),
  ]);

  return ok(
    windows.map((w) => ({
      id: w.id,
      season: w.season,
      name: w.name,
      status: w.status,
      openAt: w.openAt,
      closeAt: w.closeAt,
      createdAt: w.createdAt,
      listingCount: w._count.listings,
      active: active?.id === w.id,
    })),
  );
}

export async function getActiveTransferWindowAction() {
  const actor = await currentActor();
  if (!actor) return err("Sign in to continue.");
  return ok(await getOpenTransferWindow());
}

/* --------------------------------- writes ---------------------------------- */

export async function createTransferWindowAction(input: {
  season: string;
  name: string;
  closeAt?: string | null;
  openImmediately?: boolean;
}) {
  const res = await requireAdmin();
  if (!res.ok) return res;

  const season = input.season.trim();
  const name = input.name.trim();
  if (!season) return err("Season is required (e.g. 2026/27).");
  if (!name) return err("Window name is required (e.g. Summer 2026).");

  const closeAt = parseDate(input.closeAt);
  if (closeAt === undefined) return err("Close date is not a valid date.");
  if (input.openImmediately && closeAt && closeAt <= new Date())
    return err("Close date is in the past — pick a future date or leave it empty.");

  try {
    const window = await prisma.$transaction(async (tx) => {
      if (input.openImmediately) {
        await tx.transferWindow.updateMany({
          where: { status: "OPEN" },
          data: { status: "CLOSED", closeAt: new Date() },
        });
      }
      return tx.transferWindow.create({
        data: {
          season,
          name,
          closeAt: closeAt ?? null,
          status: input.openImmediately ? "OPEN" : "DRAFT",
          openAt: input.openImmediately ? new Date() : null,
        },
      });
    });
    return ok(window);
  } catch (e) {
    console.error(e);
    return err("Could not create the transfer window.");
  }
}

export async function setTransferWindowStatusAction(input: {
  windowId: string;
  status: "DRAFT" | "OPEN" | "CLOSED";
  closeAt?: string | null;
}) {
  const res = await requireAdmin();
  if (!res.ok) return res;

  const window = await prisma.transferWindow.findUnique({ where: { id: input.windowId } });
  if (!window) return err("Transfer window not found.");

  const closeAt = parseDate(input.closeAt);
  if (closeAt === undefined) return err("Close date is not a valid date.");
  const nextCloseAt = closeAt === undefined ? window.closeAt : closeAt;

  if (input.status === "OPEN" && nextCloseAt && nextCloseAt <= new Date())
    return err("Close date is in the past — pick a future date or clear it before opening.");

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (input.status === "OPEN") {
        await tx.transferWindow.updateMany({
          where: { status: "OPEN", id: { not: input.windowId } },
          data: { status: "CLOSED", closeAt: new Date() },
        });
      }
      return tx.transferWindow.update({
        where: { id: input.windowId },
        data: {
          status: input.status,
          closeAt: nextCloseAt,
          ...(input.status === "OPEN" ? { openAt: window.openAt ?? new Date() } : {}),
          ...(input.status === "CLOSED" ? { closeAt: new Date() } : {}),
        },
      });
    });
    return ok(updated);
  } catch (e) {
    console.error(e);
    return err("Could not update the transfer window.");
  }
}

export async function deleteTransferWindowAction(windowId: string) {
  const res = await requireAdmin();
  if (!res.ok) return res;

  const window = await prisma.transferWindow.findUnique({ where: { id: windowId } });
  if (!window) return err("Transfer window not found.");
  if (window.status === "OPEN") return err("Close the window before deleting it.");

  try {
    await prisma.transferWindow.delete({ where: { id: windowId } });
    return ok({ deleted: true });
  } catch (e) {
    console.error(e);
    return err("Could not delete the transfer window.");
  }
}
