import { prisma } from "@/lib/prisma";
import { PublicShell } from "@/components/site";
import { PlayersIndex } from "@/components/players";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const [players, referees, fans] = await Promise.all([
    prisma.user.findMany({
      where: { role: "PLAYER" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, teams: { include: { team: { select: { name: true, slug: true } } } } },
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
  ]);

  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl font-black tracking-tight text-fg">People</h1>
        <p className="mt-1 text-muted">Everyone on the pitch and in the stands — players, referees and fans.</p>
        <PlayersIndex
          players={players.map((u) => ({ id: u.id, name: u.name, teams: u.teams.map((t) => ({ name: t.team.name, slug: t.team.slug })) }))}
          referees={referees.map((u) => ({ id: u.id, name: u.name, matches: u._count.matchesRefereed }))}
          fans={fans.map((u) => ({ id: u.id, name: u.name }))}
        />
      </div>
    </PublicShell>
  );
}
