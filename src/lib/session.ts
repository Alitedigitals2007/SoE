import { auth } from "@/auth";
import type { Role } from "@/lib/domain";

export type SessionActor = { userId: string; role: Role };

/**
 * Resolve the signed-in actor, or null. Used by server actions and RSC pages.
 */
export async function currentActor(): Promise<SessionActor | null> {
  const session = await auth();
  if (!session?.user) return null;
  return { userId: session.user.id, role: session.user.role };
}
