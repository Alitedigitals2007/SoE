import { prisma } from "@/lib/prisma";
import { PublicShell } from "@/components/site";
import { PlayersIndex } from "@/components/players";
import { getMotmLeaders } from "@/lib/stats/player";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const [players, referees, fans, goalRounds, motmCounts, leaders] = await Promise.all([
    prisma.user.findMany({
      where: { role: "PLAYER" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        teams: { include: { team: { select: { name: true, slug: true } } } },
      },
    }),
    prisma.user.findMany({
      where: { role: "REFEREE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { matchesRefereed: true } } },
    }),
    prisma.user.findMany({
      where: { role: "USER" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
      take: 100,
    }),
    // Every decided goal across finished matches → per-player goal/assist counts.
    prisma.round.findMany({
      where: { status: "DECIDED", decision: "GOAL", match: { status: "FINISHED" } },
      select: {
        goalSubmission: { select: { player: { select: { userId: true } } } },
        assistPlayer: { select: { userId: true } },
      },
    }),
    // Automatic MOTM awards per player.
    prisma.match.groupBy({
      by: ["motmUserId"],
      where: { status: "FINISHED", motmUserId: { not: null } },
      _count: { motmUserId: true },
    }),
    getMotmLeaders(6),
  ]);

  const goals = new Map<string, number>();
  const assists = new Map<string, number>();
  for (const r of goalRounds) {
    const scorer = r.goalSubmission?.player.userId;
    if (scorer) goals.set(scorer, (goals.get(scorer) ?? 0) + 1);
    const assister = r.assistPlayer?.userId;
    if (assister) assists.set(assister, (assists.get(assister) ?? 0) + 1);
  }
  const motmByUser = new Map(
    motmCounts
      .filter((m): m is typeof m & { motmUserId: string } => m.motmUserId !== null)
      .map((m) => [m.motmUserId, m._count.motmUserId]),
  );

  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl font-black tracking-tight text-fg">People</h1>
        <p className="mt-1 text-muted">Everyone on the pitch and in the stands — players, referees and fans.</p>
        <PlayersIndex
          players={players.map((u) => ({
            id: u.id,
            name: u.name,
            imageUrl: u.imageUrl,
            goals: goals.get(u.id) ?? 0,
            assists: assists.get(u.id) ?? 0,
            motm: motmByUser.get(u.id) ?? 0,
            teams: u.teams.map((t) => ({ name: t.team.name, slug: t.team.slug })),
          }))}
          referees={referees.map((u) => ({ id: u.id, name: u.name, matches: u._count.matchesRefereed }))}
          fans={fans.map((u) => ({ id: u.id, name: u.name }))}
          leaders={leaders}
        />
      </div>
    </PublicShell>
  );
}
