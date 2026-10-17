"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge, Button, Select, cn } from "@/components/ui";

export type TeamOption = { id: string; name: string; slug: string; code: string };

export type H2HMatch = {
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

function teamRating(matches: H2HMatch[], teamId: string): number {
  let rating = 50;
  for (const m of matches) {
    const isHome = m.homeTeamId === teamId;
    const gf = isHome ? m.homeScore : m.awayScore;
    const ga = isHome ? m.awayScore : m.homeScore;
    rating += gf * 2 - ga;
    if (gf > ga) rating += 3;
    else if (gf === ga) rating += 1;
    else rating -= 2;
  }
  return rating;
}

export function H2HClient({
  teams,
  teamAId,
  teamBId,
  matches,
}: {
  teams: TeamOption[];
  teamAId: string | null;
  teamBId: string | null;
  matches: H2HMatch[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const aId = teamAId ?? undefined;
  const bId = teamBId ?? undefined;

  const [aSel, setASel] = useState(teamAId ?? "");
  const [bSel, setBSel] = useState(teamBId ?? "");

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (aSel) params.set("teamA", aSel);
    else params.delete("teamA");
    if (bSel) params.set("teamB", bSel);
    else params.delete("teamB");
    router.push(`/h2h?${params.toString()}`);
  }

  function clearTeams() {
    setASel("");
    setBSel("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("teamA");
    params.delete("teamB");
    router.push(`/h2h?${params.toString()}`);
  }

  const showForm = !aId || !bId || aId === bId;
  const ta = teams.find((t) => t.id === aId) ?? null;
  const tb = teams.find((t) => t.id === bId) ?? null;

  let rec: { aWins: number; bWins: number; draws: number; aGoals: number; bGoals: number } | null = null;
  let ra = 0;
  let rb = 0;
  if (ta && tb && ta.id !== tb.id) {
    let aWins = 0;
    let bWins = 0;
    let draws = 0;
    let aGoals = 0;
    let bGoals = 0;
    for (const m of matches) {
      const aSide = m.homeTeamId === ta.id ? "HOME" : "AWAY";
      const aGf = aSide === "HOME" ? m.homeScore : m.awayScore;
      const aGa = aSide === "HOME" ? m.awayScore : m.homeScore;
      aGoals += aGf;
      bGoals += aGa;
      if (aGf > aGa) aWins += 1;
      else if (aGf === aGa) draws += 1;
      else bWins += 1;
    }
    rec = { aWins, bWins, draws, aGoals, bGoals };
    ra = teamRating(matches, ta.id);
    rb = teamRating(matches, tb.id);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight text-fg">Head to Head</h1>
      <p className="mt-1 text-muted">
        Search previous matches between two teams — who owns the rivalry, the record, and each side&rsquo;s rating.
      </p>

      <div className="mt-6 rounded-2xl border-2 border-fg/15 bg-bg-elevated p-5">
        <form className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] items-end" onSubmit={onSearch}>
          <Select
            value={aSel}
            onChange={(e) => setASel(e.target.value)}
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
            value={bSel}
            onChange={(e) => setBSel(e.target.value)}
            aria-label="Team B"
          >
            <option value="">Team B</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
            <Button type="submit" disabled={!aSel || !bSel || aSel === bSel}>
              Search
            </Button>
            {aId || bId || aSel || bSel ? (
              <button
                type="button"
                onClick={clearTeams}
                className="text-xs font-bold underline underline-offset-2 hover:text-brand"
              >
                Clear
              </button>
            ) : null}
            {aSel && bSel && aSel === bSel ? (
              <span className="text-xs font-semibold text-danger">Pick two different teams.</span>
            ) : null}
          </div>
        </form>

        {showForm ? (
          <p className="mt-3 text-sm text-muted">Pick two different teams to see their head-to-head history.</p>
        ) : null}

        {rec && ta && tb ? (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border-2 border-teama/60 bg-teama/20 p-4 text-center">
                <p className="text-xs font-black uppercase tracking-wider text-teama">{ta.name}</p>
                <p className="text-2xl font-black tabular-nums text-teama">{ra}</p>
                <p className="text-[10px] text-muted">rating</p>
              </div>
              <div className="rounded-2xl border-2 border-line-strong bg-surface p-4 text-center">
                <p className="text-xs font-black uppercase tracking-wider text-muted">Record</p>
                <div className="mt-1 flex items-center justify-center gap-2 text-xl font-black tabular-nums text-fg">
                  <span className="text-success">{rec.aWins}</span>
                  <span className="text-muted">–</span>
                  <span className="text-warning">{rec.draws}</span>
                  <span className="text-muted">–</span>
                  <span className="text-danger">{rec.bWins}</span>
                </div>
                <p className="mt-1 text-[10px] text-muted">{rec.aGoals}–{rec.bGoals} goals</p>
              </div>
              <div className="rounded-2xl border-2 border-teamb/60 bg-teamb/20 p-4 text-center">
                <p className="text-xs font-black uppercase tracking-wider text-teamb">{tb.name}</p>
                <p className="text-2xl font-black tabular-nums text-teamb">{rb}</p>
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
                      const winner =
                        m.homeScore > m.awayScore ? m.homeTeamId : m.homeScore < m.awayScore ? m.awayTeamId : null;
                      const wonByA = winner === ta.id;
                      const wonByB = winner === tb.id;
                      return (
                        <tr key={m.id} className="hover:bg-bg-raised transition-colors">
                          <td className="px-4 py-2.5 text-muted tabular-nums">
                            {m.finishedAt
                              ? new Date(m.finishedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
                              : "—"}
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
  );
}
