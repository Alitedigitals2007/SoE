import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PublicShell } from "@/components/site";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function FantasyIndex() {
  const session = await auth();
  const comps = await prisma.competition.findMany({
    where: { status: { not: "FINISHED" } },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { fantasyEntries: true, teams: true } },
      fantasyEntries: session?.user
        ? { where: { userId: session.user.id }, select: { id: true, points: true, name: true } }
        : false,
      teams: { take: 1, select: { team: { select: { name: true } } } },
    },
  });

  return (
    <PublicShell>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-center gap-3">
          <span aria-hidden className="text-3xl">⭐</span>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-fg">Fantasy</h1>
            <p className="text-muted">Pick up to 5 real players per competition — every goal they score earns your entry points.</p>
          </div>
        </div>

        {comps.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-line-strong bg-white p-10 text-center">
            <p className="text-4xl" aria-hidden>🏟️</p>
            <p className="mt-2 font-semibold text-fg">No active competitions</p>
            <p className="text-sm text-muted">Fantasy opens for a competition once it is created.</p>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {comps.map((c) => {
              const mine = c.fantasyEntries && c.fantasyEntries.length > 0 ? c.fantasyEntries[0] : null;
              return (
                <Link key={c.id} href={`/fantasy/${c.id}`} className="group rounded-2xl border border-line bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-brand/40 hover:shadow-lg">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-lg font-extrabold text-fg group-hover:text-brand">{c.name}</p>
                      <p className="text-xs text-subtle">{c.season}</p>
                    </div>
                    <Badge tone={c.type === "CUP" ? "info" : "pitch"}>{c.type === "CUP" ? "Cup" : "League"}</Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                    <Badge tone="neutral">{c._count.teams} teams</Badge>
                    <Badge tone="neutral">{c._count.fantasyEntries} entries</Badge>
                    {mine ? (
                      <Badge tone="gold">
                        Your entry: {mine.points} pts
                      </Badge>
                    ) : (
                      <span className="text-xs text-subtle">No entry yet</span>
                    )}
                  </div>
                  <p className="mt-3 text-sm font-semibold text-brand">
                    {mine ? "Manage your XI →" : "Build your XI →"}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </PublicShell>
  );
}
