"use server";

import { AuthError } from "next-auth";
import { Prisma } from "@prisma/client";
import { signIn, signOut } from "@/auth";
import { currentActor } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

export async function loginAction(input: {
  email: string;
  password: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  if (!email || !password) return { ok: false, error: "Email and password are required." };
  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") return { ok: false, error: "Invalid email or password." };
      return { ok: false, error: "Sign-in failed, please try again." };
    }
    throw error; // redirect to "/dashboard" handled by NextAuth
  }
}

export async function registerAction(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  if (!name) return { ok: false, error: "Your name is required." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };

  try {
    await prisma.user.create({
      data: { name, email, passwordHash: await hashPassword(password), role: "PLAYER" },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return { ok: false, error: "An account with that email already exists — sign in instead." };
    console.error("registerAction failed", e);
    return { ok: false, error: "Could not create your account, please try again." };
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: "Account created — please sign in." };
    }
    throw error;
  }
}

export async function whoAmI() {
  return currentActor();
}
