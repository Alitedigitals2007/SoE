import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PublicShell } from "@/components/site";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TeamsIndex() {
  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { members: true, homeMatches: true, awayMatches: true } } },
  });

  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl font-black tracking-tight text-fg">Teams</h1>
        <p className="mt-1 text-muted">Clubs of eight registered quiz players.</p>

        {teams.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-line-strong bg-white p-10 text-center">
            <p className="text-4xl" aria-hidden>👥</p>
            <p className="mt-2 font-semibold text-fg">No teams yet</p>
            <p className="text-sm text-muted">Teams appear once an admin registers a club.</p>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((t) => {
              const played = t._count.homeMatches + t._count.awayMatches;
              return (
                <Link key={t.id} href={`/teams/${t.slug}`} className="group rounded-2xl border border-line bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-brand/40 hover:shadow-lg">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-lg font-extrabold text-fg group-hover:text-brand">{t.name}</p>
                      <p className="text-xs text-subtle">@{t.slug}</p>
                    </div>
                    <span aria-hidden className="grid size-10 place-items-center rounded-xl brand-gradient text-white shadow-sm">
                      {t._count.members}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge tone="pitch">{t._count.members}/8 players</Badge>
                    <Badge tone="neutral">{played} matches</Badge>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </PublicShell>
  );
}
