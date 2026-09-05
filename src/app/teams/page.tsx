import { prisma } from "@/lib/prisma";
import { PublicShell } from "@/components/site";
import { TeamsIndex } from "@/components/teams";

export const dynamic = "force-dynamic";

export default async function TeamsIndexPage() {
  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { members: true, homeMatches: true, awayMatches: true } },
      members: { where: { isCaptain: true }, select: { user: { select: { name: true } } }, take: 1 },
    },
  });

  const finished = await prisma.match.findMany({
    where: { status: "FINISHED" },
    select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true },
  });

  const records = new Map<string, { p: number; w: number; d: number; l: number; gf: number; ga: number }>();
  for (const m of finished) {
    const sides: [string | null, number, number][] = [
      [m.homeTeamId, m.homeScore, m.awayScore],
      [m.awayTeamId, m.awayScore, m.homeScore],
    ];
    for (const [teamId, scored, conceded] of sides) {
      if (!teamId) continue;
      const rec = records.get(teamId) ?? { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
      rec.p++;
      rec.gf += scored;
      rec.ga += conceded;
      if (scored > conceded) rec.w++;
      else if (scored < conceded) rec.l++;
      else rec.d++;
      records.set(teamId, rec);
    }
  }

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
          <TeamsIndex
            teams={teams.map((t) => {
              const rec = records.get(t.id) ?? { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
              return {
                id: t.id,
                name: t.name,
                slug: t.slug,
                imageUrl: t.imageUrl,
                captain: t.members[0]?.user.name ?? null,
                members: t._count.members,
                matches: rec.p,
                rec,
              };
            })}
          />
        )}
      </div>
    </PublicShell>
  );
}
