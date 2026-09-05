import { prisma } from "@/lib/prisma";
import { PublicShell } from "@/components/site";
import { TeamsIndex } from "@/components/teams";

export const dynamic = "force-dynamic";

export default async function TeamsIndexPage() {
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
          <div className="mt-8 rounded-2xl border-2 border-dashed border-fg/15 bg-bg-elevated p-10 text-center">
            <p className="text-4xl" aria-hidden>👥</p>
            <p className="mt-2 font-semibold text-fg">No teams yet</p>
            <p className="text-sm text-muted">Teams appear once an admin registers a club.</p>
          </div>
        ) : (
          <TeamsIndex teams={teams.map((t) => ({ id: t.id, name: t.name, slug: t.slug, members: t._count.members, matches: t._count.homeMatches + t._count.awayMatches }))} />
        )}
      </div>
    </PublicShell>
  );
}
