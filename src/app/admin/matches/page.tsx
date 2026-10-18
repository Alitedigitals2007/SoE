import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardHeader, Input } from "@/components/ui";
import { StatusBadge } from "../page";
import { UrlPagination } from "@/components/UrlPagination";
import type { TeamSide } from "@/lib/domain";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

type SetupMatch = {
  roster: { team: TeamSide; role: "STARTER" | "SUB" | "OUT"; isCaptain: boolean }[];
  questions: { roundNumber: number | null }[];
};

/** Mirrors the kick-off rules: 5 players per side, exactly 5 starters + a captain each, 10 played slots. */
function setupState(m: SetupMatch) {
  const home = m.roster.filter((r) => r.team === "HOME");
  const away = m.roster.filter((r) => r.team === "AWAY");
  const rosterReady = home.length >= 5 && away.length >= 5;
  const starters = (side: { role: string }[]) => side.filter((r) => r.role === "STARTER").length;
  const captainsReady = home.some((r) => r.isCaptain) && away.some((r) => r.isCaptain);
  const lineupReady = starters(home) === 5 && starters(away) === 5 && captainsReady;
  const placed = m.questions.filter((q) => q.roundNumber != null).length;
  const questionsReady = placed >= 10;
  const done = [rosterReady, lineupReady, questionsReady].filter(Boolean).length;
  return { done, ready: done === 3, placed, rosterCount: m.roster.length };
}

export default async function AdminMatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; setup?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = (sp.q ?? "").trim();
  const setupOnly = sp.setup === "incomplete";

  const where = q
    ? {
        OR: [
          { code: { contains: q, mode: "insensitive" as const } },
          { homeName: { contains: q, mode: "insensitive" as const } },
          { awayName: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const include = {
    referee: { select: { name: true } },
    roster: { select: { team: true, role: true, isCaptain: true } },
    questions: { select: { roundNumber: true } },
  } as const;

  let matches: {
    id: string;
    code: string;
    status: string;
    homeName: string;
    awayName: string;
    countdownSeconds: number;
    referee: { name: string } | null;
    roster: { team: TeamSide; role: "STARTER" | "SUB" | "OUT"; isCaptain: boolean }[];
    questions: { roundNumber: number | null }[];
  }[];
  let total: number;

  if (setupOnly) {
    const drafts = await prisma.match.findMany({
      where: { ...where, status: "DRAFT" },
      orderBy: { createdAt: "desc" },
      include,
    });
    const incomplete = drafts.filter((m) => !setupState(m).ready);
    total = incomplete.length;
    matches = incomplete.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  } else {
    [matches, total] = await Promise.all([
      prisma.match.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include,
      }),
      prisma.match.count({ where }),
    ]);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = q ? `q=${encodeURIComponent(q)}` : "";

  return (
    <>
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-fg">Matches</h1>
            <p className="text-sm text-muted">Open a match to manage its roster, line-ups and questions.</p>
          </div>
          <Link href="/admin/matches/new" className="inline-flex h-10 items-center rounded-lg bg-gold px-4 text-sm font-medium text-gold-ink hover:bg-gold-strong">
            + New match
          </Link>
        </div>

        <form action="/admin/matches" method="get" className="mt-4 flex max-w-2xl gap-2">
          {setupOnly ? <input type="hidden" name="setup" value="incomplete" /> : null}
          <Input name="q" defaultValue={q} placeholder="Search by code, home or away team…" className="max-w-md" />
          <button className="rounded-xl bg-fg px-4 py-2.5 font-semibold text-white transition-colors hover:bg-brand">
            Search
          </button>
          {(q || setupOnly) && (
            <Link href="/admin/matches" className="rounded-xl bg-surface px-4 py-2.5 font-semibold text-fg transition-colors hover:bg-line">
              Clear
            </Link>
          )}
        </form>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Link
            href={qs ? `/admin/matches?${qs}` : "/admin/matches"}
            className={
              !setupOnly
                ? "rounded-full border-2 border-brand bg-brand/10 px-3 py-1 text-xs font-bold text-brand-deep"
                : "rounded-full border-2 border-line bg-surface px-3 py-1 text-xs font-bold text-muted hover:border-line-strong hover:text-fg"
            }
          >
            All matches
          </Link>
          <Link
            href={qs ? `/admin/matches?setup=incomplete&${qs}` : "/admin/matches?setup=incomplete"}
            className={
              setupOnly
                ? "rounded-full border-2 border-warning bg-warning/10 px-3 py-1 text-xs font-bold text-warning"
                : "rounded-full border-2 border-line bg-surface px-3 py-1 text-xs font-bold text-muted hover:border-line-strong hover:text-fg"
            }
          >
            Needs setup
          </Link>
        </div>

        <Card className="mt-5">
          <CardHeader title={`${setupOnly ? "Drafts needing setup" : "All matches"} (${total})`} />
          {matches.length === 0 ? (
            <p className="p-6 text-sm text-muted">
              {setupOnly
                ? "Nothing to finish — every draft match is ready for kick-off."
                : q
                  ? "No matches match your search."
                  : "No matches yet."}
            </p>
          ) : (
            <ul className="divide-y divide-line/70">
              {matches.map((m) => {
                const st = setupState(m);
                return (
                  <li key={m.id}>
                    <Link href={`/admin/matches/${m.code}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm transition-colors hover:bg-surface">
                      <span className="min-w-0">
                        <span className="block font-medium text-fg">
                          {m.homeName} <span className="text-subtle">v</span> {m.awayName}
                        </span>
                        <span className="text-xs text-subtle">
                          Code {m.code} · Referee {m.referee?.name ?? "Unassigned"} · {st.rosterCount}/16 shirts · {st.placed}/10 questions placed
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        {m.status === "DRAFT" ? (
                          st.ready ? (
                            <Badge tone="pitch">Ready to kick off</Badge>
                          ) : (
                            <Badge tone="warning">Setup {st.done}/3</Badge>
                          )
                        ) : null}
                        <Badge tone="neutral">{m.countdownSeconds}s countdown</Badge>
                        <StatusBadge status={m.status} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Suspense>
          <UrlPagination page={page} totalPages={totalPages} basePath="/admin/matches" />
        </Suspense>
      </main>
    </>
  );
}
