import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PublicShell } from "@/components/site";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function FixturesPage() {
  const [live, scheduled, results] = await Promise.all([
    prisma.match.findMany({ where: { status: "LIVE" }, orderBy: { startedAt: "asc" } }),
    prisma.match.findMany({ where: { status: "DRAFT" }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.match.findMany({ where: { status: "FINISHED" }, orderBy: { finishedAt: "desc" }, take: 30 }),
  ]);

  return (
    <PublicShell>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-black tracking-tight text-fg">Fixtures</h1>
        <p className="mt-1 text-muted">Every match across leagues, cups and friendlies.</p>

        <FixturesGroup title="Live now" tone="success" matches={live} live />
        <FixturesGroup title="Upcoming" tone="warning" matches={scheduled} />
        <FixturesGroup title="Results" tone="neutral" matches={results} />
      </div>
    </PublicShell>
  );
}

function FixturesGroup({
  title,
  matches,
  tone,
  live,
}: {
  title: string;
  matches: { id: string; code: string; homeName: string; awayName: string; homeScore: number; awayScore: number; status: string }[];
  tone: "success" | "warning" | "neutral";
  live?: boolean;
}) {
  return (
    <section className="mt-8">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold text-fg">{title}</h2>
        <Badge tone={tone}>{matches.length}</Badge>
      </div>
      {matches.length === 0 ? (
        <p className="mt-2 rounded-xl border border-dashed border-line-strong bg-white p-6 text-center text-sm text-muted">
          Nothing here yet.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {matches.map((m) => {
            const showScore = m.status === "FINISHED" || live;
            return (
              <Link key={m.id} href={`/match/${m.code}`} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md">
                <p className="flex min-w-0 flex-1 items-center justify-between gap-2 text-sm font-semibold text-fg">
                  <span className="min-w-0 flex-1 truncate text-right">{m.homeName}</span>
                  <span className="mx-2 rounded-lg bg-surface px-3 py-1 font-black tabular-nums">
                    {showScore ? `${m.homeScore} – ${m.awayScore}` : "vs"}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{m.awayName}</span>
                </p>
                <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted">
                  {live ? (
                    <>
                      <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-danger" /> Live
                    </>
                  ) : m.status === "FINISHED" ? (
                    "Full-time"
                  ) : (
                    "Scheduled"
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
