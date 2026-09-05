import { prisma } from "@/lib/prisma";
import { PublicShell } from "@/components/site";
import { CompetitionsGrid, type CompetitionCard } from "@/components/competitions";

export const dynamic = "force-dynamic";

export default async function CompetitionsIndex() {
  const comps = await prisma.competition.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { teams: true, matches: true } } },
  });

  const cards: CompetitionCard[] = comps.map((c) => ({
    id: c.id,
    name: c.name,
    season: c.season,
    slug: c.slug,
    type: c.type,
    status: c.status,
    teams: c._count.teams,
    fixtures: c._count.matches,
  }));

  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl font-black tracking-tight text-fg">Leagues & knockout cups</h1>
        <p className="mt-1 text-muted">Round-robin tables and single-elimination brackets.</p>

        {cards.length === 0 ? (
          <div className="mt-8 rounded-2xl border-2 border-dashed border-fg/15 bg-bg-elevated p-10 text-center">
            <p className="text-2xl" aria-hidden>🏆</p>
            <p className="mt-2 font-semibold text-fg">No competitions yet</p>
            <p className="text-sm text-muted">Leagues and cups will appear here once an admin sets them up.</p>
          </div>
        ) : (
          <CompetitionsGrid comps={cards} />
        )}
      </div>
    </PublicShell>
  );
}
