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

export function SiteLogo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex shrink-0 items-center gap-2" aria-label="Stadium of Elite home">
      <span aria-hidden className="grid size-8 place-items-center rounded-lg brand-gradient text-white shadow-sm">
        ⚽
      </span>
      <span className="text-base font-black uppercase tracking-tight text-fg">
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
    <header className="sticky top-0 z-40 border-b border-line bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        <SiteLogo />

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-md px-2.5 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-fg"
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
                className="inline-flex h-9 items-center rounded-lg bg-surface px-3 text-sm font-semibold text-fg transition-colors hover:bg-line"
              >
                Dashboard
              </Link>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-fg"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-muted transition-colors hover:bg-surface hover:text-fg"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="inline-flex h-9 items-center rounded-lg brand-gradient px-4 text-sm font-semibold text-white shadow-sm transition-transform hover:brightness-105"
              >
                Join free
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-line/70 lg:hidden">
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2" aria-label="Primary small screens">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface hover:text-fg",
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
    <footer className="mt-auto border-t border-line bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <SiteLogo />
          <p className="mt-3 max-w-sm text-sm text-muted">
            Live quiz football: two teams, ten questions, one referee. Leagues, knockout cups and fantasy —
            every correct answer is a goal.
          </p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-subtle">Platform</p>
          <ul className="mt-3 space-y-2 text-sm">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="text-muted transition-colors hover:text-brand">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-subtle">Account</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/register" className="text-muted transition-colors hover:text-brand">
                Create account
              </Link>
            </li>
            <li>
              <Link href="/login" className="text-muted transition-colors hover:text-brand">
                Sign in
              </Link>
            </li>
            <li>
              <Link href="/dashboard" className="text-muted transition-colors hover:text-brand">
                Dashboard
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line py-4 text-center text-xs text-subtle">
        © {new Date().getFullYear()} Stadium of Elite
      </div>
    </footer>
  );
}
