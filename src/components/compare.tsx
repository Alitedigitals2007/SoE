"use client";

import * as React from "react";
import { playerStatsAction, teamStatsAction } from "@/app/actions/platform";
import { Button, Card, CardHeader, Select } from "@/components/ui";

type Opt = { id: string; name: string };
type Kind = "players" | "teams";

type Stats = {
  kind: Kind;
  name: string;
  fields: { label: string; value: string; accent?: "win" | "loss" | "brand" }[];
  link: string;
};

type PlayerStatsR = { id: string; name: string; role: string; goals: number; matches: number; wins: number; teams: { name: string; slug: string; code: string }[] };
type TeamStatsR = { id: string; name: string; slug: string; code: string; p: number; w: number; d: number; l: number; gf: number; ga: number; recent: unknown[]; members: unknown[] };

export function CompareApp({ players, teams }: { players: Opt[]; teams: Opt[] }) {
  const [kind, setKind] = React.useState<Kind>("players");
  const [a, setA] = React.useState("");
  const [b, setB] = React.useState("");
  const [stats, setStats] = React.useState<{ a: Stats; b: Stats } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function run() {
    if (!a || !b || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (kind === "players") {
        const [ra, rb] = await Promise.all([playerStatsAction(a), playerStatsAction(b)]);
        if (!ra.ok || !rb.ok) {
          setError((ra.ok ? rb.error : ra.error) ?? "Could not load stats.");
          return;
        }
        setStats({ a: playerStats(ra.data), b: playerStats(rb.data) });
      } else {
        const [ra, rb] = await Promise.all([teamStatsAction(a), teamStatsAction(b)]);
        if (!ra.ok || !rb.ok) {
          setError((ra.ok ? rb.error : ra.error) ?? "Could not load stats.");
          return;
        }
        setStats({ a: teamStats(ra.data), b: teamStats(rb.data) });
      }
    } catch (e) {
      console.error(e);
      setError("Could not compare — please try again.");
    } finally {
      setBusy(false);
    }
  }

  const opts = kind === "players" ? players : teams;

  return (
    <div className="mt-6 space-y-6">
      <Card>
        <CardHeader title="Compare" description="Pick two players or two teams to see them side by side." />
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap gap-2">
            <ModeBtn active={kind === "players"} onClick={() => { setKind("players"); setStats(null); setA(""); setB(""); }} label="👤 Players" />
            <ModeBtn active={kind === "teams"} onClick={() => { setKind("teams"); setStats(null); setA(""); setB(""); }} label="🏟️ Teams" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Select aria-label="First entity" value={a} onChange={(e) => setA(e.target.value)}>
                <option value="">Choose first…</option>
                {opts.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Select aria-label="Second entity" value={b} onChange={(e) => setB(e.target.value)}>
                <option value="">Choose second…</option>
                {opts.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </Select>
            </div>
          </div>
          {error ? <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
          <Button onClick={() => void run()} loading={busy} disabled={!a || !b}>
            Compare
          </Button>
        </div>
      </Card>

      {stats ? (
        <Card>
          <CompareTable a={stats.a} b={stats.b} />
        </Card>
      ) : null}
    </div>
  );
}

function numberFrom(v: string): number | null {
  const m = v.replace(/%/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function CompareTable({ a, b }: { a: Stats; b: Stats }) {
  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 pt-5">
        <p className="truncate text-right text-base font-extrabold text-fg">{a.name}</p>
        <p className="w-20 text-center text-[10px] font-black uppercase tracking-widest text-subtle">Stat</p>
        <p className="truncate text-base font-extrabold text-fg">{b.name}</p>
      </div>
      <div className="mt-2 divide-y divide-line/60 border-t-2 border-fg/10">
        {a.fields.map((fa, i) => {
          const fb = b.fields[i];
          if (!fb) return null;
          const na = numberFrom(fa.value);
          const nb = numberFrom(fb.value);
          const aWin = na !== null && nb !== null && na > nb;
          const bWin = na !== null && nb !== null && nb > na;
          const aNeutralAccent = fa.accent === "brand" ? "text-brand" : "";
          const bNeutralAccent = fb.accent === "brand" ? "text-brand" : "";
          return (
            <div key={fa.label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-2.5">
              <p className={`truncate text-right font-black tabular-nums ${aWin ? "text-success" : bWin ? "text-subtle opacity-60" : aNeutralAccent || "text-fg"}`}>
                {fa.value}
              </p>
              <p className="w-20 text-center text-[10px] font-bold uppercase tracking-wider text-muted">{fa.label}</p>
              <p className={`truncate font-black tabular-nums ${bWin ? "text-success" : aWin ? "text-subtle opacity-60" : bNeutralAccent || "text-fg"}`}>
                {fb.value}
              </p>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
        <a href={a.link} className="text-sm font-semibold text-brand underline-offset-2 hover:underline">
          {a.kind === "players" ? "Player" : "Team"} profile →
        </a>
        <span className="text-xs text-subtle">Lower values show dimmed when the other side leads.</span>
        <a href={b.link} className="text-sm font-semibold text-brand underline-offset-2 hover:underline">
          {b.kind === "players" ? "Player" : "Team"} profile →
        </a>
      </div>
    </div>
  );
}

function ModeBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
        active ? "border-brand bg-brand/10 text-brand-deep" : "border-line bg-surface text-muted hover:text-fg"
      }`}
    >
      {label}
    </button>
  );
}

function playerStats(d: PlayerStatsR): Stats {
  const wr = d.matches ? Math.round((d.wins / d.matches) * 100) : 0;
  return {
    kind: "players",
    name: d.name,
    link: `/players/${d.id}`,
    fields: [
      { label: "Goals", value: String(d.goals), accent: "brand" },
      { label: "Matches", value: String(d.matches) },
      { label: "Wins", value: String(d.wins), accent: "win" },
      { label: "Win rate", value: `${wr}%` },
      { label: "Teams", value: String(d.teams.length) },
    ],
  };
}

function teamStats(d: TeamStatsR): Stats {
  const pts = d.w * 3 + d.d;
  return {
    kind: "teams",
    name: d.name,
    link: `/teams/${d.slug}`,
    fields: [
      { label: "Played", value: String(d.p) },
      { label: "Won", value: String(d.w), accent: "win" },
      { label: "Drawn", value: String(d.d) },
      { label: "Lost", value: String(d.l), accent: "loss" },
      { label: "Goals for–against", value: `${d.gf}–${d.ga}` },
      { label: "Points", value: String(pts), accent: "brand" },
    ],
  };
}
