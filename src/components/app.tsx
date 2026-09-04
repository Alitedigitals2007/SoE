"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Badge } from "@/components/ui";
import type { ActionResult, Role } from "@/lib/domain";
import { cn } from "@/components/ui";

const roleLabel: Record<Role, string> = {
  ADMIN: "Admin",
  REFEREE: "Referee",
  PLAYER: "Player",
};

export function TopBar({
  name,
  role,
}: {
  name: string;
  role: Role;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex items-center gap-2 text-sm font-bold tracking-wide text-fg">
          <span aria-hidden className="grid size-6 place-items-center rounded-md bg-gold text-gold-ink">
            ⚽
          </span>
          <span>
            STADIUM <span className="text-gold">OF ELITE</span>
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          <RoleLinks role={role} />
          <Badge tone={role === "ADMIN" ? "gold" : role === "REFEREE" ? "info" : "pitch"}>
            {roleLabel[role]}
          </Badge>
          <span className="hidden text-sm text-muted sm:inline">{name}</span>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/login" })}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface hover:text-fg"
          >
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}

function RoleLinks({ role }: { role: Role }) {
  const href = role === "ADMIN" ? "/admin" : role === "REFEREE" ? "/referee" : "/player";
  const label = role === "ADMIN" ? "Dashboard" : role === "REFEREE" ? "My matches" : "My matches";
  return (
    <Link
      href={href}
      className="hidden rounded-md px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface hover:text-fg sm:inline-block"
    >
      {label}
    </Link>
  );
}

/** Runs an async server action, then refreshes the RSC payload. */
export function useActionRun() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  async function run(action: () => Promise<ActionResult>, opts?: { message?: string; refresh?: boolean }) {
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const res = await action();
      if (res.ok) {
        if (opts?.message) setNotice(opts.message);
        if (opts?.refresh !== false) router.refresh();
        return true;
      }
      setError(res.error);
      return false;
    } catch (e) {
      console.error(e);
      setError("Unexpected error — please try again.");
      return false;
    } finally {
      setPending(false);
    }
  }

  return { run, pending, error, notice, setError };
}

export function ActionBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>;
}
