import { prisma } from "@/lib/prisma";
import { PublicShell } from "@/components/site";
import { PlayersIndex } from "@/components/players";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const users = await prisma.user.findMany({
    where: { role: "PLAYER" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      teams: { include: { team: { select: { name: true, slug: true } } } },
    },
  });

  return (
    <PublicShell>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-black tracking-tight text-fg">Players</h1>
        <p className="mt-1 text-muted">Everyone registered on the pitch.</p>
        <PlayersIndex players={users.map((u) => ({ id: u.id, name: u.name, teams: u.teams.map((t) => ({ name: t.team.name, slug: t.team.slug })) }))} />
      </div>
    </PublicShell>
  );
}
