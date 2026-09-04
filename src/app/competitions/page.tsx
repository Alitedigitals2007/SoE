import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PublicShell } from "@/components/site";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CompetitionsIndex() {
  const comps = await prisma.competition.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { teams: true, matches: true } } },
  });

  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl font-black tracking-tight text-fg">Leagues & knockout cups</h1>
        <p className="mt-1 text-muted">Round-robin tables and single-elimination brackets.</p>

        {comps.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-line-strong bg-white p-10 text-center">
            <p className="text-2xl" aria-hidden>🏆</p>
            <p className="mt-2 font-semibold text-fg">No competitions yet</p>
            <p className="text-sm text-muted">Leagues and cups will appear here once an admin sets them up.</p>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {comps.map((c) => {
              const cup = c.type === "CUP";
              return (
                <Link
                  key={c.id}
                  href={`/competition/${c.slug}`}
                  className="group rounded-2xl border border-line bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-brand/40 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-lg font-extrabold text-fg group-hover:text-brand">{c.name}</p>
                      <p className="text-xs text-subtle">{c.season}</p>
                    </div>
                    <span aria-hidden className="text-3xl">{cup ? "🏆" : "📊"}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Badge tone={cup ? "info" : "pitch"}>{cup ? "Knockout cup" : "League"}</Badge>
                    <Badge tone={c.status === "FINISHED" ? "neutral" : c.status === "ACTIVE" ? "success" : "warning"}>
                      {c.status === "FINISHED" ? "Finished" : c.status === "ACTIVE" ? "Active" : "Setup"}
                    </Badge>
                  </div>
                  <p className="mt-4 text-sm text-muted">
                    {c._count.teams} teams · {c._count.matches} fixtures
                  </p>
                  <p className="mt-2 text-sm font-semibold text-brand">
                    {cup ? "View bracket" : "View table"} →
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
