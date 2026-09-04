"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { currentActor } from "@/lib/session";

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function loginAction(input: {
  email: string;
  password: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  if (!email || !password) return { ok: false, error: "Email and password are required." };
  try {
    await signIn("credentials", { email, password, redirectTo: "/" });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") return { ok: false, error: "Invalid email or password." };
      return { ok: false, error: "Sign-in failed, please try again." };
    }
    throw error; // redirect to "/" handled by NextAuth
  }
}

export async function whoAmI() {
  return currentActor();
}
