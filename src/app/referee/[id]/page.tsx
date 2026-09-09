import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PublicShell } from "@/components/site";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function RefereeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const referee = await prisma.user.findFirst({
    where: { id, role: "REFEREE" },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      matchesRefereed: {
        orderBy: { startedAt: "desc" },
        take: 30,
        select: {
          code: true,
          homeName: true,
          awayName: true,
          homeScore: true,
          awayScore: true,
          status: true,
          scheduledAt: true,
          startedAt: true,
        },
      },
    },
  });
  if (!referee) notFound();

  const finished = referee.matchesRefereed.filter((m) => m.status === "FINISHED").length;
  const live = referee.matchesRefereed.filter((m) => m.status === "LIVE").length;

  return (
    <PublicShell>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex flex-wrap items-center gap-4">
          <span aria-hidden className="grid size-14 place-items-center rounded-2xl bg-gold/15 text-2xl">
            🎫
          </span>
          <div>
            <h1 className="font-display text-2xl font-black uppercase tracking-wider text-fg">{referee.name}</h1>
            <p className="text-sm text-muted">Referee · joined {referee.createdAt.toLocaleDateString()}</p>
          </div>
          <Link href="/players" className="ml-auto inline-flex h-10 items-center rounded-lg bg-surface px-4 text-sm font-semibold text-fg hover:bg-line">
            ← People
          </Link>
        </div>

        {/* stats */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="rounded-xl border-2 border-fg/15 bg-bg-elevated p-4 text-center">
            <p className="text-3xl font-black tabular-nums text-fg">{finished}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Matches refereed</p>
          </div>
          <div className="rounded-xl border-2 border-fg/15 bg-bg-elevated p-4 text-center">
            <p className="text-3xl font-black tabular-nums text-gold">{live}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Live now</p>
          </div>
          <div className="rounded-xl border-2 border-fg/15 bg-bg-elevated p-4 text-center">
            <p className="text-3xl font-black tabular-nums text-brand">{referee.matchesRefereed.length}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Recent listed</p>
          </div>
        </div>

        {/* recent matches */}
        <h2 className="mt-8 text-lg font-bold text-fg">Matches refereed</h2>
        {referee.matchesRefereed.length === 0 ? (
          <p className="mt-3 rounded-xl border-2 border-dashed border-fg/20 bg-bg-elevated p-8 text-center text-sm text-muted">
            No matches yet — this referee is waiting for their first fixture.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {referee.matchesRefereed.map((m) => (
              <li key={m.code}>
                <Link
                  href={`/match/${m.code}`}
                  className="flex items-center justify-between gap-3 rounded-xl border-2 border-fg/15 bg-bg-elevated px-4 py-3 transition-colors hover:border-brand/40"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">
                    {m.homeName} <span className="text-subtle">{m.status === "FINISHED" ? `${m.homeScore}–${m.awayScore}` : "v"}</span> {m.awayName}
                  </span>
                  <Badge tone={m.status === "FINISHED" ? "neutral" : m.status === "LIVE" ? "success" : "warning"}>
                    {m.status === "FINISHED" ? "FT" : m.status === "LIVE" ? "Live" : "Upcoming"}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PublicShell>
  );
}
