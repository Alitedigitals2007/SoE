import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Role } from "@/lib/domain";

export type SessionUser = { id: string; role: Role; name: string; email: string };

export function homePath(role: Role): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "REFEREE":
      return "/referee";
    case "PLAYER":
      return "/player";
    case "USER":
      return "/fantasy";
  }
}

/**
 * Server-side gate: must be signed in with one of `roles` (any when empty).
 * Redirects to /login or the caller's own home when not satisfied.
 */
export async function requireRole(roles: Role[] = []): Promise<SessionUser> {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");
  if (roles.length > 0 && !roles.includes(user.role)) redirect(homePath(user.role));
  return user;
}
