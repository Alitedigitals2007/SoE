import * as React from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { homePath } from "@/lib/authz";
import { unreadCount } from "@/lib/notify";
import { NAV } from "@/lib/nav";
import { cn } from "@/components/ui";
import { MobileNav } from "@/components/nav";
import { DesktopNav } from "@/components/DesktopNav";
import { UserMenu } from "@/components/UserMenu";

const ROLE_LABEL = {
  ADMIN: "Admin",
  REFEREE: "Referee",
  PLAYER: "Player",
  USER: "Fan",
} as const;

export function SiteLogo({ href = "/", tone = "default" }: { href?: string; tone?: "default" | "inverse" }) {
  return (
    <Link href={href} className="flex shrink-0 items-center gap-2" aria-label="Stadium of Elite home">
      <span aria-hidden className="grid size-9 place-items-center rounded-xl border-2 border-fg brand-gradient text-white shadow-[3px_3px_0_rgba(11,32,48,.2)]">
        ⚽
      </span>
      <span className={cn("font-display text-lg font-black uppercase leading-none tracking-tight", tone === "inverse" ? "text-white" : "text-fg")}>
        Stadium<span className="text-brand"> of Elite</span>
      </span>
    </Link>
  );
}

export async function SiteHeader() {
  const session = await auth();
  const user = session?.user ?? null;
  const roleHome = user ? homePath(user.role) : "/";
  const unread = user ? await unreadCount(user.id) : 0;

  return (
    <header className="sticky top-0 z-40 border-b-2 border-fg bg-bg/95 backdrop-blur-md">
      <div className="scoreboard-strip flex h-7 items-center overflow-hidden whitespace-nowrap">
        <div className="animate-marquee flex min-w-max items-center gap-12 px-4">
          <span>STADIUM OF ELITE // MATCHDAY</span><span>⚽ LIVE QUIZ FOOTBALL</span><span>LEAGUES · CUPS · FANTASY</span>
          <span>STADIUM OF ELITE // MATCHDAY</span><span>⚽ LIVE QUIZ FOOTBALL</span><span>LEAGUES · CUPS · FANTASY</span>
        </div>
      </div>
      <div className="mx-auto flex h-[4.75rem] max-w-7xl items-center justify-between gap-4 px-4">
        <SiteLogo />

        <DesktopNav />

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                href="/notifications"
                aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
                className="relative inline-flex size-10 items-center justify-center rounded-lg text-lg transition-colors hover:bg-surface"
              >
                🔔
                {unread > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-black text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                ) : null}
              </Link>
              <UserMenu
                name={user.name ?? "Account"}
                roleHome={roleHome}
                roleLabel={ROLE_LABEL[user.role]}
              />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex h-10 items-center rounded-lg px-3 text-xs font-black uppercase tracking-wider text-muted transition-colors hover:bg-surface hover:text-fg"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="inline-flex h-10 items-center rounded-lg border-2 border-fg brand-gradient px-4 text-xs font-black uppercase tracking-wider text-white shadow-[3px_3px_0_rgba(11,32,48,.2)] transition-all hover:-translate-y-0.5 hover:brightness-105"
              >
                Join free
              </Link>
            </>
          )}
        </div>
      </div>

      <MobileNav />
    </header>
  );
}

export async function PublicShell({ children }: { children: React.ReactNode }) {  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t-2 border-fg bg-fg text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <SiteLogo tone="inverse" />
          <p className="mt-3 max-w-sm text-sm text-white/65">
            Live quiz football: two teams, ten questions, one referee. Leagues, knockout cups and fantasy —
            every correct answer is a goal.
          </p>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-gold">Platform</p>
          <ul className="mt-3 space-y-2 text-sm">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="text-sm text-white/65 transition-colors hover:text-white">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-gold">Account</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/register" className="text-sm text-white/65 transition-colors hover:text-white">
                Create account
              </Link>
            </li>
            <li>
              <Link href="/login" className="text-sm text-white/65 transition-colors hover:text-white">
                Sign in
              </Link>
            </li>
            <li>
              <Link href="/dashboard" className="text-sm text-white/65 transition-colors hover:text-white">
                Dashboard
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/45">
        © {new Date().getFullYear()} Stadium of Elite
      </div>
    </footer>
  );
}
