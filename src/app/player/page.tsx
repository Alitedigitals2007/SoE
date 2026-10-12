import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getPlayerStats } from "@/lib/stats/player";
import { TopBar } from "@/components/app";
import { PlayerHub, type PlayerComplaint, type PlayerFixture } from "@/components/PlayerHub";
import { formatKickoffWat } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PlayerHome() {
  const user = await requireRole(["PLAYER"]);

  const [profile, slots, stats, rawComplaints] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { imageUrl: true } }),
    prisma.matchPlayer.findMany({
      where: { userId: user.id },
      orderBy: [{ match: { status: "asc" } }, { match: { createdAt: "desc" } }],
      include: {
        match: {
          include: { competition: { select: { name: true, type: true } } },
        },
      },
    }),
    getPlayerStats(user.id),
    prisma.complaint.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { match: { select: { homeName: true, awayName: true } } },
    }),
  ]);

  const fixtures: PlayerFixture[] = slots.map((s) => ({
    id: s.id,
    code: s.match.code,
    homeName: s.match.homeName,
    awayName: s.match.awayName,
    status: s.match.status,
    scheduledAt: s.match.scheduledAt?.toISOString() ?? null,
    kickoffText: s.match.scheduledAt ? formatKickoffWat(s.match.scheduledAt.toISOString()) : null,
    homeScore: s.match.homeScore,
    awayScore: s.match.awayScore,
    team: s.team,
    number: s.number,
    role: s.role,
    isCaptain: s.isCaptain,
    competition: s.match.competition,
    cupRound: s.match.cupRound,
  }));

  const complaints: PlayerComplaint[] = rawComplaints.map((c) => ({
    id: c.id,
    type: c.type,
    subject: c.subject,
    message: c.message,
    status: c.status,
    adminNote: c.adminNote,
    fixture: c.match ? `${c.match.homeName} v ${c.match.awayName}` : null,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <>
      <TopBar name={user.name} role={user.role} />
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        <h1 className="text-2xl font-bold text-fg">Player dashboard</h1>
        <p className="mb-2 text-sm text-muted">
          Your fixtures, goals, assists and everything in between.
        </p>
        <PlayerHub name={user.name} imageUrl={profile?.imageUrl ?? null} fixtures={fixtures} stats={stats} complaints={complaints} />
      </main>
    </>
  );
}
