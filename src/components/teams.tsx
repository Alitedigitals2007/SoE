"use client";

import * as React from "react";
import Link from "next/link";
import { Input, Badge } from "@/components/ui";

type Rec = { p: number; w: number; d: number; l: number; gf: number; ga: number };

type Team = {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  captain?: string | null;
  members: number;
  matches: number;
  rec: Rec;
};

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
          {filtered.map((t) => {
            const played = t.matches;
            return (
              <Link key={t.id} href={`/teams/${t.slug}`} className="group rounded-2xl border-2 border-fg/15 bg-bg-elevated p-6 shadow-[4px_4px_0_rgba(11,32,48,.08)] transition-all hover:-translate-y-1 hover:border-brand/40 hover:shadow-lg">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {t.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.imageUrl} alt={`${t.name} crest`} className="size-12 shrink-0 rounded-xl border border-fg/15 bg-white object-cover" />
                    ) : (
                      <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-xl brand-gradient text-white shadow-sm">
                        {t.name.slice(0, 1)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-lg font-extrabold text-fg group-hover:text-brand">{t.name}</p>
                      <p className="truncate text-xs text-subtle">@{t.slug}</p>
                    </div>
                  </div>
                  <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface text-sm font-black text-fg">
                    {t.members}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge tone="pitch">{t.members}/8 players</Badge>
                  <Badge tone="neutral">{played} played</Badge>
                  {t.captain ? <Badge tone="gold">C {t.captain}</Badge> : null}
                </div>
                {played > 0 ? (
                  <div className="mt-4 grid grid-cols-4 gap-2 rounded-lg bg-surface/70 p-2 text-center">
                    <div>
                      <p className="text-base font-black tabular-nums text-success">{t.rec.w}</p>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-muted">Won</p>
                    </div>
                    <div>
                      <p className="text-base font-black tabular-nums text-fg">{t.rec.d}</p>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-muted">Draw</p>
                    </div>
                    <div>
                      <p className="text-base font-black tabular-nums text-danger">{t.rec.l}</p>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-muted">Lost</p>
                    </div>
                    <div>
                      <p className="text-base font-black tabular-nums text-brand">{t.rec.gf}–{t.rec.ga}</p>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-muted">GF–GA</p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 rounded-lg bg-surface/70 px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-subtle">
                    No results yet
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
