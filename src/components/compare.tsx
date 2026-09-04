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
          <div className="grid md:grid-cols-2">
            <CompareCol stats={stats.a} highlight />
            <CompareCol stats={stats.b} />
          </div>
        </Card>
      ) : null}
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

function CompareCol({ stats, highlight }: { stats: Stats; highlight?: boolean }) {
  return (
    <div className={`p-6 ${highlight ? "md:border-r md:border-line" : ""}`}>
      <p className="text-lg font-extrabold text-fg">{stats.name}</p>
      <dl className="mt-4 space-y-2 text-sm">
        {stats.fields.map((f) => (
          <div key={f.label} className="flex items-center justify-between border-b border-line/60 pb-1.5">
            <dt className="text-muted">{f.label}</dt>
            <dd className={`font-black tabular-nums ${f.accent === "brand" ? "text-brand" : f.accent === "win" ? "text-success" : f.accent === "loss" ? "text-danger" : "text-fg"}`}>
              {f.value}
            </dd>
          </div>
        ))}
      </dl>
      <a href={stats.link} className="mt-4 inline-block text-sm font-semibold text-brand underline-offset-2 hover:underline">
        View full profile →
      </a>
    </div>
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
