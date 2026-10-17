import { prisma } from "@/lib/prisma";
import { PublicShell } from "@/components/site";
import { H2HClient, type H2HMatch } from "./h2h-client";

export const dynamic = "force-dynamic";

export default async function H2HPage({
  searchParams,
}: {
  searchParams: Promise<{ teamA?: string; teamB?: string }>;
}) {
  const sp = await searchParams;
  const aId = sp.teamA || undefined;
  const bId = sp.teamB || undefined;

  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, code: true },
  });

  let matches: H2HMatch[] = [];
  if (aId && bId && aId !== bId) {
    const raw = await prisma.match.findMany({
      where: {
        status: "FINISHED",
        OR: [
          { homeTeamId: aId, awayTeamId: bId },
          { homeTeamId: bId, awayTeamId: aId },
        ],
      },
      orderBy: { finishedAt: "desc" },
      select: {
        id: true,
        code: true,
        homeName: true,
        awayName: true,
        homeScore: true,
        awayScore: true,
        finishedAt: true,
        competition: { select: { name: true } },
        homeTeamId: true,
        awayTeamId: true,
      },
    });

    matches = raw.map((m) => ({
      id: m.id,
      code: m.code,
      homeName: m.homeName,
      awayName: m.awayName,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      finishedAt: m.finishedAt,
      competition: m.competition?.name ?? null,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
    }));
  }

  return (
    <PublicShell>
      <H2HClient
        teams={teams}
        teamAId={aId ?? null}
        teamBId={bId ?? null}
        matches={matches}
      />
    </PublicShell>
  );
}
