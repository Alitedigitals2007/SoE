import { prisma } from "@/lib/prisma";
import { CompetitionWizard } from "@/components/admin/CompetitionWizard";
import type { TeamOption } from "@/components/platformAdmin";

export const dynamic = "force-dynamic";

export default async function AdminNewCompetition() {
  const teams: TeamOption[] = await prisma.team.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true } });

  return (
    <>
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <h1 className="text-2xl font-bold text-fg">New competition</h1>
        <p className="mb-5 text-sm text-muted">Create clubs first so you can seed the competition with teams.</p>
        <CompetitionWizard teams={teams} />
      </main>
    </>
  );
}
