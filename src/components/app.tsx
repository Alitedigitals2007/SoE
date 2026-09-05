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
  USER: "Fan",
};

export function TopBar({
  name,
  role,
}: {
  name: string;
  role: Role;
}) {
  return (
    <header className="sticky top-0 z-30 border-b-2 border-fg bg-bg/95 backdrop-blur">
      <div className="scoreboard-strip flex h-6 items-center justify-center text-[.58rem]">
        ADMIN / REFEREE CONTROL ROOM · STADIUM OF ELITE
      </div>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex items-center gap-2 text-sm font-bold tracking-wide text-fg">
          <span aria-hidden className="grid size-8 place-items-center rounded-lg border-2 border-fg brand-gradient text-white shadow-[2px_2px_0_rgba(11,32,48,.18)]">
            ⚽
          </span>
          <span className="font-display font-black uppercase">
            STADIUM <span className="text-gold">OF ELITE</span>
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          <RoleLinks role={role} />
          <Badge tone={role === "ADMIN" ? "gold" : role === "REFEREE" ? "info" : role === "USER" ? "neutral" : "pitch"}>
            {roleLabel[role]}
          </Badge>
          <span className="hidden text-sm text-muted sm:inline">{name}</span>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/login" })}
            className="rounded-lg px-2.5 py-2 text-[.65rem] font-black uppercase tracking-wider text-muted transition-colors hover:bg-fg hover:text-white"
          >
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}

function RoleLinks({ role }: { role: Role }) {
  const href = role === "ADMIN" ? "/admin" : role === "REFEREE" ? "/referee" : role === "PLAYER" ? "/player" : "/fantasy";
  const label = role === "ADMIN" ? "Dashboard" : role === "REFEREE" ? "My matches" : role === "PLAYER" ? "My matches" : "Fantasy";
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
