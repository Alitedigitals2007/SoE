import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/app";
import { Badge } from "@/components/ui";
import { RosterManager, type AvailablePlayer, type RosterPlayer } from "@/components/admin";
import { StatusBadge } from "../../page";

export const dynamic = "force-dynamic";

export default async function AdminMatchPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await requireRole(["ADMIN"]);
  const { code } = await params;
  const match = await prisma.match.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      referee: { select: { name: true } },
      roster: { include: { user: { select: { id: true, name: true } } }, orderBy: [{ team: "asc" }, { number: "asc" }] },
    },
  });
  if (!match) notFound();

  const availableRows = await prisma.user.findMany({
    where: { role: "PLAYER", rosterSlots: { none: { matchId: match.id } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });

  const roster: RosterPlayer[] = match.roster.map((r) => ({
    userId: r.userId,
    name: r.user.name,
    team: r.team,
    number: r.number,
    role: r.role,
  }));
  const available: AvailablePlayer[] = availableRows.map((a) => ({ ...a }));

  return (
    <>
      <TopBar name={user.name} role={user.role} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-fg">
              {match.homeName} <span className="text-subtle">v</span> {match.awayName}
            </h1>
            <p className="text-sm text-muted">
              Match code <span className="font-semibold text-gold">{match.code}</span> · {match.referee.name ?? "No referee"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={match.status} />
            <Badge tone="neutral">{match.countdownSeconds}s / question</Badge>
            <Link href={`/match/${match.code}`} className="inline-flex h-10 items-center rounded-lg bg-surface px-4 text-sm font-medium text-fg hover:bg-bg-raised">
              Open match →
            </Link>
          </div>
        </div>

        <p className="mb-5 mt-1 text-sm text-muted">Assign the 16 players — shirt 1–8 per team. The referee then names 5 starters and a captain per side and adds the ten questions.</p>

        <RosterManager
          code={match.code}
          status={match.status}
          homeName={match.homeName}
          awayName={match.awayName}
          roster={roster}
          available={available}
        />
      </main>
    </>
  );
}
