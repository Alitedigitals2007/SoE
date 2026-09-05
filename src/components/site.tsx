import * as React from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { signOutAction } from "@/app/actions/auth";
import { homePath } from "@/lib/authz";
import { cn } from "@/components/ui";

const NAV = [
  { href: "/fixtures", label: "Fixtures" },
  { href: "/live", label: "Live" },
  { href: "/competitions", label: "Leagues & Cups" },
  { href: "/teams", label: "Teams" },
  { href: "/players", label: "Players" },
  { href: "/compare", label: "Compare" },
  { href: "/fantasy", label: "Fantasy" },
] as const;

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

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-lg px-2.5 py-2 text-[.72rem] font-black uppercase tracking-wider text-muted transition-all hover:-translate-y-0.5 hover:bg-fg hover:text-white"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                href={roleHome}
                className="inline-flex h-10 items-center rounded-lg border-2 border-fg bg-bg-elevated px-3 text-xs font-black uppercase tracking-wider text-fg shadow-[2px_2px_0_rgba(11,32,48,.12)] transition-all hover:-translate-y-0.5 hover:bg-surface"
              >
                Dashboard
              </Link>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="inline-flex h-10 items-center rounded-lg px-3 text-xs font-black uppercase tracking-wider text-muted transition-colors hover:bg-surface hover:text-fg"
                >
                  Sign out
                </button>
              </form>
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

      <div className="border-t-2 border-fg/10 bg-surface lg:hidden">
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2" aria-label="Primary small screens">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "shrink-0 rounded-md px-2.5 py-1.5 text-[.65rem] font-black uppercase tracking-wider text-muted transition-colors hover:bg-bg-elevated hover:text-fg",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export async function PublicShell({ children }: { children: React.ReactNode }) {
  return (
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
