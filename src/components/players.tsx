"use client";

import * as React from "react";
import Link from "next/link";
import { Input } from "@/components/ui";

export function PlayersIndex({ players }: { players: { id: string; name: string; teams: { name: string; slug: string }[] }[] }) {
  const [q, setQ] = React.useState("");
  const filtered = players.filter(
    (p) =>
      p.name.toLowerCase().includes(q.toLowerCase()) ||
      p.teams.some((t) => t.name.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="mt-6">
      <Input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`Search ${players.length} players by name or team…`}
        aria-label="Search players"
        className="max-w-md"
      />
      {filtered.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-line-strong bg-white p-8 text-center text-sm text-muted">
          No players match “{q}”.
        </p>
      ) : (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <li key={p.id}>
              <Link href={`/players/${p.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md">
                <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-sm font-black text-brand">
                  {p.name.slice(0, 1)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-fg">{p.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {p.teams.length ? p.teams.map((t) => t.name).join(", ") : "Free agent"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
