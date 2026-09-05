"use client";

import * as React from "react";
import Link from "next/link";
import { Input, Badge } from "@/components/ui";

type Team = { id: string; name: string; slug: string; members: number; matches: number };

export function TeamsIndex({ teams }: { teams: Team[] }) {
  const [q, setQ] = React.useState("");
  const filtered = teams.filter(
    (t) => t.name.toLowerCase().includes(q.toLowerCase()) || t.slug.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="mt-6">
      <Input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`Search ${teams.length} teams by name…`}
        aria-label="Search teams"
        className="max-w-md"
      />
      {filtered.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-line-strong bg-bg-elevated p-8 text-center text-sm text-muted">
          No teams match &ldquo;{q}&rdquo;.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <Link key={t.id} href={`/teams/${t.slug}`} className="group rounded-2xl border-2 border-fg/15 bg-bg-elevated p-6 shadow-[4px_4px_0_rgba(11,32,48,.08)] transition-all hover:-translate-y-1 hover:border-brand/40 hover:shadow-lg">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-lg font-extrabold text-fg group-hover:text-brand">{t.name}</p>
                  <p className="text-xs text-subtle">@{t.slug}</p>
                </div>
                <span aria-hidden className="grid size-10 place-items-center rounded-xl brand-gradient text-white shadow-sm">
                  {t.members}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone="pitch">{t.members}/8 players</Badge>
                <Badge tone="neutral">{t.matches} matches</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
