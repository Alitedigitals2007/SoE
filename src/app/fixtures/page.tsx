import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { PublicShell } from "@/components/site";
import { Badge } from "@/components/ui";
import { FixturesPagination } from "@/components/FixturesPagination";
import { formatKickoffWat } from "@/lib/format";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

export default async function FixturesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; livePage?: string; upcomingPage?: string }>;
}) {
  const sp = await searchParams;
  const resultPage = Math.max(1, Number(sp.page) || 1);
  const livePage = Math.max(1, Number(sp.livePage) || 1);
  const upcomingPage = Math.max(1, Number(sp.upcomingPage) || 1);

  // Only matches with a scheduled kick-off (date & time) are shown publicly.
  const [liveMatches, liveTotal, scheduledMatches, scheduledTotal, results, resultsTotal] = await Promise.all([
    prisma.match.findMany({
      where: { status: "LIVE" },
      orderBy: { startedAt: "asc" },
      skip: (livePage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.match.count({ where: { status: "LIVE" } }),
    prisma.match.findMany({
      where: { status: "DRAFT", scheduledAt: { not: null } },
      orderBy: { scheduledAt: "asc" },
      skip: (upcomingPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.match.count({ where: { status: "DRAFT", scheduledAt: { not: null } } }),
    prisma.match.findMany({
      where: { status: "FINISHED" },
      orderBy: { finishedAt: "desc" },
      skip: (resultPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.match.count({ where: { status: "FINISHED" } }),
  ]);

  return (
    <PublicShell>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-black tracking-tight text-fg">Fixtures</h1>
        <p className="mt-1 text-muted">Every match across leagues, cups and friendlies.</p>

        <FixturesGroup
          title="Live now"
          tone="success"
          matches={liveMatches}
          live
          page={livePage}
          totalItems={liveTotal}
          section="live"
        />
        <FixturesGroup
          title="Upcoming"
          tone="warning"
          matches={scheduledMatches}
          page={upcomingPage}
          totalItems={scheduledTotal}
          section="upcoming"
        />
        <FixturesGroup
          title="Results"
          tone="neutral"
          matches={results}
          page={resultPage}
          totalItems={resultsTotal}
          section="page"
          collapsible
          defaultOpen={resultPage > 1}
        />
      </div>
    </PublicShell>
  );
}

function FixturesGroup({
  title,
  matches,
  tone,
  live,
  page,
  totalItems,
  section,
  collapsible,
  defaultOpen,
}: {
  title: string;
  matches: { id: string; code: string; homeName: string; awayName: string; homeScore: number; awayScore: number; status: string; scheduledAt: Date | null }[];
  tone: "success" | "warning" | "neutral";
  live?: boolean;
  page: number;
  totalItems: number;
  section: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  const body = matches.length === 0 ? (
    <p className="mt-2 rounded-xl border border-dashed border-line-strong bg-white p-6 text-center text-sm text-muted">
      {section === "upcoming" ? "No scheduled matches yet — kick-off times appear here once fixed." : "Nothing here yet."}
    </p>
  ) : (
    <div className="mt-3 space-y-2">
      {matches.map((m) => {
        const showScore = m.status === "FINISHED" || live;
        const scheduled = !!m.scheduledAt && m.status !== "FINISHED";
        const sideText = live ? (
          <>
            <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-danger" /> Live
          </>
        ) : m.status === "FINISHED" ? (
          "Full-time"
        ) : m.scheduledAt ? (
          formatKickoffWat(m.scheduledAt.toISOString())
        ) : (
          "Scheduled"
        );
        return (
          <Link
            key={m.id}
            href={`/match/${m.code}`}
            className="block rounded-xl border border-line bg-white px-4 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="flex min-w-0 flex-1 items-center justify-between gap-2 text-sm font-semibold text-fg">
                <span className="min-w-0 flex-1 truncate text-right">{m.homeName}</span>
                <span className="mx-2 shrink-0 rounded-lg bg-surface px-3 py-1 font-black tabular-nums">
                  {showScore ? `${m.homeScore} – ${m.awayScore}` : "vs"}
                </span>
                <span className="min-w-0 flex-1 truncate">{m.awayName}</span>
              </p>
              <span className="hidden max-w-40 shrink-0 truncate text-xs font-medium text-muted sm:block">
                {sideText}
              </span>
            </div>
            {scheduled && m.scheduledAt ? (
              <p className="mt-1.5 flex items-center gap-1.5 truncate text-[11px] font-medium text-muted sm:hidden">
                <span aria-hidden>🗓️</span> {formatKickoffWat(m.scheduledAt.toISOString())}
              </p>
            ) : null}
          </Link>
        );
      })}
    </div>
  );

  const pagination = (
    <Suspense>
      <FixturesPagination section={section} page={page} totalPages={totalPages} />
    </Suspense>
  );

  if (collapsible) {
    return (
      <details className="group mt-8" open={defaultOpen}>
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-1 -mx-2 transition-colors hover:bg-surface [&::-webkit-details-marker]:hidden">
          <h2 className="text-lg font-bold text-fg">{title}</h2>
          <Badge tone={tone}>{totalItems}</Badge>
          <span
            aria-hidden
            className="ml-auto text-base text-subtle transition-transform duration-200 group-open:rotate-180"
          >
            ▾
          </span>
        </summary>
        {body}
        {pagination}
      </details>
    );
  }

  return (
    <section className="mt-8">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold text-fg">{title}</h2>
        <Badge tone={tone}>{totalItems}</Badge>
      </div>
      {body}
      {pagination}
    </section>
  );
}
