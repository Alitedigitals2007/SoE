import Link from "next/link";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/app";
import { CreateTeamForm } from "@/components/platformAdmin";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminTeams() {
  const user = await requireRole(["ADMIN"]);
  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { members: true } } },
  });

  return (
    <>
      <TopBar name={user.name} role={user.role} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <h1 className="text-2xl font-bold text-fg">Teams</h1>
        <p className="mb-5 text-sm text-muted">Clubs of up to eight players. Competitions and league fixtures are built from these.</p>

        <CreateTeamForm />

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => (
            <Link
              key={t.id}
              href={`/admin/teams/${t.slug}`}
              className="rounded-2xl border border-line bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-extrabold text-fg">{t.name}</p>
                  <p className="text-xs text-subtle">@{t.slug}</p>
                </div>
                <Badge tone="neutral">{t.code}</Badge>
              </div>
              <p className="mt-3 text-sm text-muted">{t._count.members} players</p>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
