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

type SideStats = {
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  cleanSheets: number;
  biggestWin: string | null;
  form: Array<"W" | "D" | "L">;
};

function sideStats(matches: H2HMatch[], teamId: string): SideStats {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let cleanSheets = 0;
  let bestMargin = 0;
  let biggestWin: string | null = null;
  const form: Array<"W" | "D" | "L"> = [];
  for (const m of matches) {
    const isHome = m.homeTeamId === teamId;
    const gf = isHome ? m.homeScore : m.awayScore;
    const ga = isHome ? m.awayScore : m.homeScore;
    goalsFor += gf;
    goalsAgainst += ga;
    let result: "W" | "D" | "L";
    if (gf > ga) {
      wins += 1;
      result = "W";
    } else if (gf === ga) {
      draws += 1;
      result = "D";
    } else {
      losses += 1;
      result = "L";
    }
    if (form.length < 5) form.push(result);
    if (ga === 0) cleanSheets += 1;
    if (gf > ga && gf - ga > bestMargin) {
      bestMargin = gf - ga;
      biggestWin = `${gf}–${ga}`;
    }
  }
  return { wins, draws, losses, goalsFor, goalsAgainst, cleanSheets, biggestWin, form };
}

type CompareRow = {
  label: string;
  a: number | string;
  b: number | string;
  lowerBetter?: boolean;
  signed?: boolean;
};

function winnerOf(row: CompareRow): "a" | "b" | null {
  if (typeof row.a !== "number" || typeof row.b !== "number") return null;
  if (row.a === row.b || row.lowerBetter === undefined) return null;
  const aBetter = row.lowerBetter ? row.a < row.b : row.a > row.b;
  return aBetter ? "a" : "b";
}

function formatCell(row: CompareRow, v: number | string): string {
  if (row.signed && typeof v === "number" && v > 0) return `+${v}`;
  return String(v);
}

function FormChip({ r }: { r: "W" | "D" | "L" }) {
  return (
    <span
      className={cn(
        "grid size-5 place-items-center rounded text-[10px] font-black text-white",
        r === "W" ? "bg-success" : r === "D" ? "bg-warning" : "bg-danger",
      )}
    >
      {r}
    </span>
  );
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
  let aStats: SideStats | null = null;
  let bStats: SideStats | null = null;
  let ra = 0;
  let rb = 0;
  if (ta && tb && ta.id !== tb.id) {
    aStats = sideStats(matches, ta.id);
    bStats = sideStats(matches, tb.id);
    rec = {
      aWins: aStats.wins,
      bWins: bStats.wins,
      draws: aStats.draws,
      aGoals: aStats.goalsFor,
      bGoals: bStats.goalsFor,
    };
    ra = teamRating(matches, ta.id);
    rb = teamRating(matches, tb.id);
  }

  const avg = (goals: number, played: number) => (played > 0 ? (goals / played).toFixed(1) : "0.0");

  const compareRows: CompareRow[] =
    aStats && bStats
      ? [
          { label: "Wins", a: aStats.wins, b: bStats.wins, lowerBetter: false },
          { label: "Draws", a: aStats.draws, b: bStats.draws },
          { label: "Losses", a: aStats.losses, b: bStats.losses, lowerBetter: true },
          { label: "Goals scored", a: aStats.goalsFor, b: bStats.goalsFor, lowerBetter: false },
          { label: "Goals conceded", a: aStats.goalsAgainst, b: bStats.goalsAgainst, lowerBetter: true },
          {
            label: "Goal difference",
            a: aStats.goalsFor - aStats.goalsAgainst,
            b: bStats.goalsFor - bStats.goalsAgainst,
            lowerBetter: false,
            signed: true,
          },
          {
            label: "Goals / match",
            a: avg(aStats.goalsFor, matches.length),
            b: avg(bStats.goalsFor, matches.length),
            lowerBetter: false,
          },
          { label: "Clean sheets", a: aStats.cleanSheets, b: bStats.cleanSheets, lowerBetter: false },
          { label: "Biggest win", a: aStats.biggestWin ?? "—", b: bStats.biggestWin ?? "—" },
        ]
      : [];

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
            <div className="mt-6 overflow-hidden rounded-2xl border-2 border-line-strong bg-bg-elevated">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b-2 border-line/70 bg-surface px-4 py-4">
                <div className="min-w-0">
                  <p className="truncate text-xs font-black uppercase tracking-wider text-teama">{ta.name}</p>
                  <p className="text-3xl font-black tabular-nums text-fg">{ra}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">rating</p>
                </div>
                <div className="w-28 text-center sm:w-40">
                  <p className="text-[10px] font-black uppercase tracking-wider text-subtle">Head to head</p>
                  <p className="text-xl font-black tabular-nums text-fg">
                    <span className="text-success">{rec.aWins}</span>
                    <span className="text-muted">–</span>
                    <span className="text-warning">{rec.draws}</span>
                    <span className="text-muted">–</span>
                    <span className="text-danger">{rec.bWins}</span>
                  </p>
                  <p className="text-[10px] text-muted">
                    {matches.length} {matches.length === 1 ? "match" : "matches"}
                  </p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="truncate text-xs font-black uppercase tracking-wider text-teamb">{tb.name}</p>
                  <p className="text-3xl font-black tabular-nums text-fg">{rb}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">rating</p>
                </div>
              </div>

              {compareRows.map((row) => {
                const w = winnerOf(row);
                return (
                  <div
                    key={row.label}
                    className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-line/50 px-4 py-2 last:border-0"
                  >
                    <p
                      className={cn(
                        "truncate text-sm font-black tabular-nums",
                        w === "a" ? "text-success" : w === "b" ? "text-fg/50" : "text-fg",
                      )}
                    >
                      {formatCell(row, row.a)}
                    </p>
                    <p className="w-28 text-center text-[10px] font-black uppercase tracking-wider text-subtle sm:w-40">
                      {row.label}
                    </p>
                    <p
                      className={cn(
                        "truncate text-right text-sm font-black tabular-nums",
                        w === "b" ? "text-success" : w === "a" ? "text-fg/50" : "text-fg",
                      )}
                    >
                      {formatCell(row, row.b)}
                    </p>
                  </div>
                );
              })}

              {aStats && bStats ? (
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-2.5">
                  <div className="flex gap-1">
                    {aStats.form.length === 0 ? <span className="text-sm text-muted">—</span> : null}
                    {aStats.form.map((r, i) => (
                      <FormChip key={i} r={r} />
                    ))}
                  </div>
                  <p className="w-28 text-center text-[10px] font-black uppercase tracking-wider text-subtle sm:w-40">
                    Form (last 5)
                  </p>
                  <div className="flex justify-end gap-1">
                    {bStats.form.length === 0 ? <span className="text-sm text-muted">—</span> : null}
                    {bStats.form.map((r, i) => (
                      <FormChip key={i} r={r} />
                    ))}
                  </div>
                </div>
              ) : null}
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
