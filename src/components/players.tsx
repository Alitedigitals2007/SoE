"use client";

import * as React from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Badge, Input, cn } from "@/components/ui";

type Person = {
  id: string;
  name: string;
  matches?: number;
  imageUrl?: string | null;
  goals?: number;
  assists?: number;
  motm?: number;
  teams?: { name: string; slug: string }[];
};
type Leader = { userId: string; name: string; imageUrl: string | null; motm: number; points: number };
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
  leaders,
}: {
  players: Person[];
  referees: Person[];
  fans: Person[];
  leaders: Leader[];
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

      {tab === "players" && leaders.length > 0 ? (
        <section className="mt-6 rounded-2xl border-2 border-gold/40 bg-gold/5 p-5">
          <h2 className="text-xs font-black uppercase tracking-widest text-gold-strong">
            🏅 Player of the Match leaders
          </h2>
          <p className="mt-0.5 text-xs text-muted">Automatic MOTM awards across every competition.</p>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2">
            {leaders.slice(0, 6).map((l, i) => (
              <li key={l.userId}>
                <Link
                  href={`/players/${l.userId}`}
                  className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2.5 transition-colors hover:border-gold/50"
                >
                  <span className="w-6 text-center text-sm font-black text-subtle">{i + 1}</span>
                  <Avatar name={l.name} src={l.imageUrl} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-fg">{l.name}</span>
                    <span className="text-[11px] text-muted">{l.points} performance pts</span>
                  </span>
                  <Badge tone="gold">{l.motm} × MOTM</Badge>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {filtered.length === 0 ? (
        <p className="mt-6 rounded-2xl border-2 border-dashed border-fg/20 bg-bg-elevated p-10 text-center text-sm text-muted">
          {q ? `No ${tab} match “${q}”.` : `No ${tab.replace("s", "")} registered yet.`}
        </p>
      ) : (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <li key={p.id}>
              <Link
                href={tab === "players" ? `/players/${p.id}` : tab === "referees" ? `/referee/${p.id}` : "/players"}
                className="flex items-center gap-3 rounded-xl border-2 border-fg/15 bg-bg-elevated px-4 py-3 shadow-[3px_3px_0_rgba(11,32,48,.06)] transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
              >
                {tab === "players" ? (
                  <Avatar name={p.name} src={p.imageUrl} size={40} />
                ) : (
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-full text-sm font-black",
                      tab === "referees" ? "bg-gold/15 text-gold-strong" : "bg-surface text-muted",
                    )}
                  >
                    {tab === "referees" ? "🎫" : p.name.slice(0, 1)}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-fg">{p.name}</span>
                  {tab === "players" ? (
                    <>
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
                      <span className="mt-0.5 flex gap-2 text-[11px] font-bold tabular-nums text-muted">
                        <span title="Goals">⚽ {p.goals ?? 0}</span>
                        <span title="Assists">🅰 {p.assists ?? 0}</span>
                        <span title="Player of the Match">🏅 {p.motm ?? 0}</span>
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-muted">
                      {tab === "referees" ? `${p.matches ?? 0} match${p.matches === 1 ? "" : "es"} refereed` : "Fantasy fan"}
                    </span>
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
