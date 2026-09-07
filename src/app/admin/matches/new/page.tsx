import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/app";
import { CreateMatchForm, type RefereeOption, type TeamOptionRow } from "@/components/admin";

export const dynamic = "force-dynamic";

export default async function NewMatchPage() {
  const user = await requireRole(["ADMIN"]);
  const referees: RefereeOption[] = await prisma.user.findMany({
    where: { role: "REFEREE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });
  const teams: TeamOptionRow[] = await prisma.team.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, _count: { select: { members: true } } },
  });

  return (
    <>
      <TopBar name={user.name} role={user.role} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <h1 className="text-2xl font-bold text-fg">New friendly match</h1>
        <p className="mb-5 text-sm text-muted">
          Pick two teams — their players load automatically. Then set the lineup, questions and kick-off time in the setup screen.
        </p>
        <CreateMatchForm referees={referees} teams={teams} />
      </main>
    </>
  );
}
