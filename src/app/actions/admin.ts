"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { currentActor } from "@/lib/session";
import type { ActionResult, Role } from "@/lib/domain";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createUserAction(input: {
  name: string;
  email: string;
  password: string;
  role: Role;
}): Promise<ActionResult<{ id: string }>> {
  const actor = await currentActor();
  if (!actor) return { ok: false, error: "Sign in to continue." };
  if (actor.role !== "ADMIN") return { ok: false, error: "Only admins can create accounts." };

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { ok: false, error: "Name is required." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (input.password.length < 8)
    return { ok: false, error: "Password must be at least 8 characters." };
  if (input.role !== "REFEREE" && input.role !== "PLAYER")
    return { ok: false, error: "Accounts can only be referee or player." };

  try {
    const user = await prisma.user.create({
      data: { name, email, passwordHash: await hashPassword(input.password), role: input.role },
      select: { id: true },
    });
    return { ok: true, data: user };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return { ok: false, error: "An account with that email already exists." };
    console.error("createUserAction failed", e);
    return { ok: false, error: "Could not create the account." };
  }
}

export async function updateUserAction(input: {
  userId: string;
  name?: string;
  role?: Role;
  password?: string;
}): Promise<ActionResult> {
  const actor = await currentActor();
  if (!actor) return { ok: false, error: "Sign in to continue." };
  if (actor.role !== "ADMIN") return { ok: false, error: "Only admins can edit accounts." };

  const data: { name?: string; role?: Role; passwordHash?: string } = {};
  if (input.name !== undefined) {
    if (!input.name.trim()) return { ok: false, error: "Name cannot be empty." };
    data.name = input.name.trim();
  }
  if (input.role !== undefined) {
    if (input.role !== "REFEREE" && input.role !== "PLAYER")
      return { ok: false, error: "Accounts can only be referee or player." };
    data.role = input.role;
  }
  if (input.password !== undefined && input.password.length > 0) {
    if (input.password.length < 8)
      return { ok: false, error: "Password must be at least 8 characters." };
    data.passwordHash = await hashPassword(input.password);
  }

  try {
    await prisma.user.update({ where: { id: input.userId }, data });
    return { ok: true, data: undefined };
  } catch (e) {
    console.error("updateUserAction failed", e);
    return { ok: false, error: "Could not update the account." };
  }
}
