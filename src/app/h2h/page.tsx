import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PublicShell } from "@/components/site";
import { Badge, Select, cn } from "@/components/ui";

type TeamOption = { id: string; name: string; slug: string; code: string };

type H2HMatch = {
  id: string;
  code: string;
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  finishedAt: Date | null;
  competition: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
};

function sideScore(m: H2HMatch, teamId: string, homeTeamId: string | null): number {
  return homeTeamId === teamId ? m.homeScore : m.awayScore;
}

function opponentScore(m: H2HMatch, teamId: string, homeTeamId: string | null): number {
  return homeTeamId === teamId ? m.awayScore : m.homeScore;
}

function teamRating(matches: H2HMatch[], teamId: string, homeTeamId: string | null): number {
  let rating = 50;
  for (const m of matches) {
    const gf = sideScore(m, teamId, homeTeamId);
    const ga = opponentScore(m, teamId, homeTeamId);
    rating += gf * 2 - ga;
    if (gf > ga) rating += 3;
    else if (gf === ga) rating += 1;
    else rating -= 2;
  }
  return rating;
}

export default async function H2HPage({
  searchParams,
}: {
  searchParams: Promise<{ teamA?: string; teamB?: string }>;
}) {
  const { teamA: aId, teamB: bId } = await searchParams;

  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, code: true },
  });

  let a: TeamOption | null = null;
  let b: TeamOption | null = null;
  let matches: H2HMatch[] = [];
  let record: { aWins: number; bWins: number; draws: number; aGoals: number; bGoals: number } | null = null;
  let ratingA = 0;
  let ratingB = 0;

  if (aId && bId && aId !== bId) {
    a = teams.find((t) => t.id === aId) ?? null;
    b = teams.find((t) => t.id === bId) ?? null;
    if (!a || !b) notFound();

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

    let aWins = 0;
    let bWins = 0;
    let draws = 0;
    let aGoals = 0;
    let bGoals = 0;
    for (const m of matches) {
      const aSide = m.homeTeamId === aId ? "HOME" : "AWAY";
      const aGf = aSide === "HOME" ? m.homeScore : m.awayScore;
      const aGa = aSide === "HOME" ? m.awayScore : m.homeScore;
      aGoals += aGf;
      bGoals += aGa;
      if (aGf > aGa) aWins += 1;
      else if (aGf === aGa) draws += 1;
      else bWins += 1;
    }
    record = { aWins, bWins, draws, aGoals, bGoals };
    ratingA = teamRating(matches, aId, aId);
    ratingB = teamRating(matches, bId, bId);
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-black tracking-tight text-fg">Head to Head</h1>
        <p className="mt-1 text-muted">
          Search previous matches between two teams — who owns the rivalry, the record, and each side&rsquo;s rating.
        </p>

        <div className="mt-6 rounded-2xl border-2 border-fg/15 bg-bg-elevated p-5">
          <form className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto] items-end">
            <Select
              value={aId ?? ""}
              onChange={(e) => {
                const url = new URL(window.location.href);
                url.searchParams.set("teamA", e.target.value);
                url.searchParams.delete("teamB");
                window.location.href = url.toString();
              }}
              aria-label="Team A"
            >
              <option value="">Team A</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <span className="text-[10px] font-black uppercase tracking-widest text-subtle self-end">v</span>
            <Select
              value={bId ?? ""}
              onChange={(e) => {
                const url = new URL(window.location.href);
                url.searchParams.set("teamB", e.target.value);
                window.location.href = url.toString();
              }}
              aria-label="Team B"
            >
              <option value="">Team B</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            {aId && bId && aId !== bId ? (
              <Link href="/h2h" className="text-xs font-bold underline underline-offset-2 hover:text-brand">
                Clear
              </Link>
            ) : null}
          </form>

          {!aId || !bId || aId === bId ? (
            <p className="mt-3 text-sm text-muted">Pick two different teams to see their head-to-head history.</p>
          ) : null}

          {record && a && b ? (
            <>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border-2 border-teama/40 bg-teama/10 p-4 text-center">
                  <p className="text-xs font-black uppercase tracking-wider text-teama">{a.name}</p>
                  <p className="text-2xl font-black tabular-nums text-teama">{ratingA}</p>
                  <p className="text-[10px] text-muted">rating</p>
                </div>
                <div className="rounded-2xl border-2 border-fg/15 bg-white p-4 text-center">
                  <p className="text-xs font-black uppercase tracking-wider text-muted">Record</p>
                  <div className="mt-1 flex items-center justify-center gap-2 text-xl font-black tabular-nums text-fg">
                    <span className="text-success">{record.aWins}</span>
                    <span className="text-muted">–</span>
                    <span className="text-warning">{record.draws}</span>
                    <span className="text-muted">–</span>
                    <span className="text-danger">{record.bWins}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-muted">{record.aGoals}–{record.bGoals} goals</p>
                </div>
                <div className="rounded-2xl border-2 border-teamb/40 bg-teamb/10 p-4 text-center">
                  <p className="text-xs font-black uppercase tracking-wider text-teamb">{b.name}</p>
                  <p className="text-2xl font-black tabular-nums text-teamb">{ratingB}</p>
                  <p className="text-[10px] text-muted">rating</p>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-line bg-white p-3 overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-line/60">
                      <th className="text-left text-xs font-black uppercase tracking-wider text-muted pb-2">Date</th>
                      <th className="text-left text-xs font-black uppercase tracking-wider text-muted pb-2">Fixture</th>
                      <th className="text-right text-xs font-black uppercase tracking-wider text-muted pb-2">Score</th>
                      <th className="text-left text-xs font-black uppercase tracking-wider text-muted pb-2">Competition</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {matches.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted">
                          No finished head-to-head matches yet.
                        </td>
                      </tr>
                    ) : (
                      matches.map((m) => {
                        // We know both ids are present, so one side matches.
                        const winner =
                          m.homeScore > m.awayScore ? m.homeTeamId : m.homeScore < m.awayScore ? m.awayTeamId : null;
                        const wonByA = winner === aId;
                        const wonByB = winner === bId;
                        return (
                          <tr key={m.id} className="hover:bg-bg-raised transition-colors">
                            <td className="px-4 py-2.5 text-muted tabular-nums">
                              {m.finishedAt?.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                            </td>
                            <td className="px-4 py-2.5 text-fg font-medium">
                              {m.homeName} <span className="text-muted">v</span> {m.awayName}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums font-black">
                              <span className={cn(wonByA ? "text-success" : wonByB ? "text-danger" : "text-muted")}>
                                {m.homeScore}
                              </span>{"–"}
                              <span className={cn(wonByB ? "text-success" : wonByA ? "text-danger" : "text-muted")}>
                                {m.awayScore}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-muted">
                              <Badge tone="neutral">{m.competition ?? "Friendly"}</Badge>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </PublicShell>
  );
}
