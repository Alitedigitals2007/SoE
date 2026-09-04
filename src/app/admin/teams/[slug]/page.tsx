import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/app";
import { Badge } from "@/components/ui";
import { TeamMembers, type AvailablePlayer, type TeamMemberRow } from "@/components/platformAdmin";

export const dynamic = "force-dynamic";

export default async function AdminTeamDetail({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireRole(["ADMIN"]);
  const { slug } = await params;
  const team = await prisma.team.findUnique({
    where: { slug },
    include: { members: { include: { user: { select: { id: true, name: true } } }, orderBy: { number: "asc" } } },
  });
  if (!team) notFound();

  const memberRows: TeamMemberRow[] = team.members.map((m) => ({ userId: m.userId, name: m.user.name, number: m.number }));
  const availableRows = await prisma.user.findMany({
    where: { role: "PLAYER", teams: { none: { teamId: team.id } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const available: AvailablePlayer[] = availableRows.map((a) => ({ ...a }));

  return (
    <>
      <TopBar name={user.name} role={user.role} />
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-fg">{team.name}</h1>
            <p className="text-sm text-muted">
              Code <Badge tone="neutral">{team.code}</Badge> · <Link className="text-subtle underline-offset-2 hover:text-brand hover:underline" href={`/teams/${team.slug}`}>Public page →</Link>
            </p>
          </div>
          <Link href="/admin/teams" className="text-sm font-medium text-muted hover:text-fg">← All teams</Link>
        </div>

        <div className="mt-5">
          <TeamMembers teamId={team.id} members={memberRows} available={available} />
        </div>
      </main>
    </>
  );
}
