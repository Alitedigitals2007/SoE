"use client";

import * as React from "react";
import Link from "next/link";
import { Badge, Input, cn } from "@/components/ui";

export type CompetitionCard = {
  id: string;
  name: string;
  season: string;
  slug: string;
  type: "LEAGUE" | "CUP" | "LEAGUE_CUP" | "CUSTOM";
  status: "DRAFT" | "ACTIVE" | "FINISHED";
  teams: number;
  fixtures: number;
};

export function statusLabel(status: CompetitionCard["status"]) {
  if (status === "FINISHED") return { text: "Closed", tone: "neutral" as const };
  if (status === "ACTIVE") return { text: "Live", tone: "success" as const };
  return { text: "Setup", tone: "warning" as const };
}

type Filter = "ALL" | "LIVE" | "CLOSED" | "SETUP";

export function CompetitionsGrid({ comps }: { comps: CompetitionCard[] }) {
  const [q, setQ] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("ALL");

  const filtered = comps.filter((c) => {
    const matchesQ =
      c.name.toLowerCase().includes(q.toLowerCase()) || c.season.toLowerCase().includes(q.toLowerCase());
    const matchesFilter =
      filter === "ALL" ||
      (filter === "LIVE" && c.status === "ACTIVE") ||
      (filter === "CLOSED" && c.status === "FINISHED") ||
      (filter === "SETUP" && c.status === "DRAFT");
    return matchesQ && matchesFilter;
  });

  const chips: { key: Filter; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "LIVE", label: "Live" },
    { key: "CLOSED", label: "Closed" },
    { key: "SETUP", label: "Setup" },
  ];

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${comps.length} competitions…`}
          aria-label="Search competitions"
          className="max-w-xs"
        />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setFilter(chip.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide transition-colors",
                filter === chip.key
                  ? "border-brand bg-brand text-white"
                  : "border-line-strong bg-surface text-muted hover:border-brand/40 hover:text-fg",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-6 rounded-2xl border-2 border-dashed border-fg/15 bg-bg-elevated p-8 text-center text-sm text-muted">
          No competitions match {q ? `“${q}”` : "that filter"}.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const cup = c.type === "CUP" || c.type === "LEAGUE_CUP";
            const st = statusLabel(c.status);
            return (
              <Link
                key={c.id}
                href={`/competition/${c.slug}`}
                className="group rounded-2xl border-2 border-fg/15 bg-bg-elevated p-6 shadow-[4px_4px_0_rgba(11,32,48,.08)] transition-all hover:-translate-y-1 hover:border-brand/40 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-extrabold text-fg group-hover:text-brand">{c.name}</p>
                    <p className="text-xs text-subtle">{c.season}</p>
                  </div>
                  <span aria-hidden className="text-3xl">{cup ? "🏆" : "📊"}</span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge tone={cup ? "info" : "pitch"}>{cup ? "Knockout cup" : "League"}</Badge>
                  <Badge tone={st.tone}>{st.text}</Badge>
                </div>
                <p className="mt-4 text-sm text-muted">
                  {c.teams} teams · {c.fixtures} fixtures
                </p>
                <p className="mt-2 text-sm font-semibold text-brand">
                  {cup ? "View bracket" : "View table"} →
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
