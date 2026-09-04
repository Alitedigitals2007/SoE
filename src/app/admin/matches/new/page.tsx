import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/app";
import { CreateMatchForm, type RefereeOption } from "@/components/admin";

export const dynamic = "force-dynamic";

export default async function NewMatchPage() {
  const user = await requireRole(["ADMIN"]);
  const referees: RefereeOption[] = await prisma.user.findMany({
    where: { role: "REFEREE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });

  return (
    <>
      <TopBar name={user.name} role={user.role} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <h1 className="text-2xl font-bold text-fg">New match</h1>
        <p className="mb-5 text-sm text-muted">Assign teams, a referee and the per-question countdown.</p>
        <CreateMatchForm referees={referees} />
      </main>
    </>
  );
}
