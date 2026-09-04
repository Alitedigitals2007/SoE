import { prisma } from "@/lib/prisma";
import { PublicShell } from "@/components/site";
import { CompareApp } from "@/components/compare";

export const dynamic = "force-dynamic";

export default async function ComparePage() {
  const players = await prisma.user.findMany({ where: { role: "PLAYER" }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const teams = await prisma.team.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  return (
    <PublicShell>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-3xl font-black tracking-tight text-fg">Compare</h1>
        <p className="mt-1 text-muted">Head-to-head numbers for any two players or teams.</p>
        <CompareApp players={players} teams={teams} />
      </div>
    </PublicShell>
  );
}
