"use client";

import * as React from "react";
import Link from "next/link";
import { Badge, Input, cn } from "@/components/ui";

type Person = { id: string; name: string; teams?: { name: string; slug: string }[] };
type Tab = "players" | "referees" | "fans";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "players", label: "Players", icon: "⚽" },
  { key: "referees", label: "Referees", icon: "🎫" },
  { key: "fans", label: "Fans & users", icon: "👥" },
];

export function PlayersIndex({
  players,
  referees,
  fans,
}: {
  players: Person[];
  referees: Person[];
  fans: Person[];
}) {
  const [tab, setTab] = React.useState<Tab>("players");
  const [q, setQ] = React.useState("");

  const current = tab === "players" ? players : tab === "referees" ? referees : fans;
  const filtered = current.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border-2 border-fg/15 bg-bg-elevated p-1" role="tablist" aria-label="People">
          {TABS.map((t) => {
            const count = t.key === "players" ? players.length : t.key === "referees" ? referees.length : fans.length;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => { setTab(t.key); setQ(""); }}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black uppercase tracking-wider transition-colors",
                  active ? "bg-fg text-white shadow-sm" : "text-muted hover:bg-bg-raised hover:text-fg",
                )}
              >
                <span aria-hidden>{t.icon}</span> {t.label}
                <span className={cn("rounded-full px-1.5 text-[10px]", active ? "bg-white/20" : "bg-surface")}>{count}</span>
              </button>
            );
          })}
        </div>
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${current.length} ${tab}…`}
          aria-label={`Search ${tab}`}
          className="max-w-xs"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="mt-6 rounded-2xl border-2 border-dashed border-fg/20 bg-bg-elevated p-10 text-center text-sm text-muted">
          {q ? `No ${tab} match “${q}”.` : `No ${tab.replace("s", "")} registered yet.`}
        </p>
      ) : (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <li key={p.id}>
              <Link
                href={tab === "players" ? `/players/${p.id}` : "/players"}
                className="flex items-center gap-3 rounded-xl border-2 border-fg/15 bg-bg-elevated px-4 py-3 shadow-[3px_3px_0_rgba(11,32,48,.06)] transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-full text-sm font-black",
                    tab === "players" ? "bg-surface text-brand" : tab === "referees" ? "bg-gold/15 text-gold-strong" : "bg-surface text-muted",
                  )}
                >
                  {tab === "referees" ? "🎫" : p.name.slice(0, 1)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-fg">{p.name}</span>
                  {tab === "players" ? (
                    <span className="flex flex-wrap gap-1">
                      {p.teams?.length ? (
                        p.teams.slice(0, 2).map((t) => (
                          <Badge key={t.slug} tone="neutral" className="!text-[9px]">
                            {t.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted">Free agent</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">{tab === "referees" ? "Match official" : "Fantasy fan"}</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
