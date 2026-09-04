import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/app";
import { Badge } from "@/components/ui";
import { CompetitionActions, FixtureRefereeRow, type TeamOption } from "@/components/platformAdmin";

export const dynamic = "force-dynamic";

export default async function AdminCompetitionDetail({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireRole(["ADMIN"]);
  const { slug } = await params;
  const comp = await prisma.competition.findUnique({
    where: { slug },
    include: {
      teams: { include: { team: { select: { id: true, name: true, code: true, slug: true } } }, orderBy: { seed: "asc" } },
      matches: { include: { referee: { select: { id: true, name: true } } }, orderBy: [{ cupRound: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!comp) notFound();

  const allTeams: TeamOption[] = await prisma.team.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true } });
  const currentTeamIds = comp.teams.map((t) => t.teamId);
  const availableTeams = allTeams.filter((t) => !currentTeamIds.includes(t.id));
  const referees = await prisma.user.findMany({ where: { role: "REFEREE" }, orderBy: { name: "asc" }, select: { id: true, name: true } });

  const maxRound = comp.matches.length ? Math.max(...comp.matches.map((m) => m.cupRound ?? 0)) : 0;
  const latestRoundMatches = maxRound ? comp.matches.filter((m) => m.cupRound === maxRound) : [];
  const finishedLatestRound = latestRoundMatches.length > 0 && latestRoundMatches.every((m) => m.status === "FINISHED");
  const cupFinalDone = comp.matches.some((m) => m.cupRound !== null && m.status === "FINISHED") && latestRoundMatches.length === 1 && finishedLatestRound;

  const fixtures = comp.matches.map((m) => ({
    id: m.id,
    code: m.code,
    homeName: m.homeName,
    awayName: m.awayName,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    status: m.status,
    cupRound: m.cupRound,
    refereeId: m.refereeId,
  }));

  return (
    <>
      <TopBar name={user.name} role={user.role} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-fg">{comp.name}</h1>
              <Badge tone={comp.type === "CUP" ? "info" : "pitch"}>{comp.type === "CUP" ? "Knockout cup" : "League"}</Badge>
              <Badge tone={comp.status === "FINISHED" ? "neutral" : comp.status === "ACTIVE" ? "success" : "warning"}>{comp.status}</Badge>
            </div>
            <p className="text-sm text-muted">
              Season {comp.season} · <Link className="text-subtle underline-offset-2 hover:text-brand hover:underline" href={`/competition/${comp.slug}`}>Public page →</Link>
            </p>
          </div>
          <Link href="/admin/competitions" className="text-sm font-medium text-muted hover:text-fg">← All competitions</Link>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-1">
            <CompetitionActions
              competitionId={comp.id}
              type={comp.type}
              hasFixtures={comp.matches.length > 0}
              availableTeams={availableTeams}
              currentTeamIds={currentTeamIds}
              finishedLatestRound={finishedLatestRound}
            />
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Teams ({comp.teams.length})</p>
              <ul className="mt-2 space-y-1 text-sm">
                {comp.teams.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-fg">
                      <span className="mr-1 text-xs text-subtle">#{t.seed}</span>
                      {t.team.name}
                    </span>
                    <Link href={`/teams/${t.team.slug}`} className="text-xs text-subtle hover:text-brand">
                      View
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-fg">Fixtures ({fixtures.length})</h2>
              {comp.type === "CUP" && maxRound ? (
                <Badge tone={cupFinalDone ? "gold" : "neutral"}>
                  {cupFinalDone ? "Cup complete — champion decided" : `Round ${maxRound}${latestRoundMatches.length === 1 ? " · final" : ""}`}
                </Badge>
              ) : null}
            </div>
            <div className="mt-3 space-y-2">
              {fixtures.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-muted">
                  No fixtures yet — use “Generate …” to create them.
                </p>
              ) : (
                fixtures.map((m) => <FixtureRefereeRow key={m.id} match={m} referees={referees} />)
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
