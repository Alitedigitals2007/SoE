"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LiveOdds } from "@/lib/bet/liveOdds";

/**
 * Live scoreboard with client-side auto-refresh (poll the RSC payload every few
 * seconds) so the "Live now" page behaves like a live stream without a reload.
 * Odds are display-only — betting closes at kick-off.
 */
export function MatchLiveCard({
  matches,
  odds,
}: {
  matches: { id: string; code: string; homeName: string; awayName: string; homeScore: number; awayScore: number }[];
  odds?: Record<string, LiveOdds>;
}) {
  const router = useRouter();
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 5000);
    return () => window.clearInterval(t);
  }, []);

  React.useEffect(() => {
    if (tick > 0) router.refresh();
  }, [tick, router]);

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      {matches.map((m) => {
        const o = odds?.[m.id];
        return (
          <Link
            key={m.id}
            href={`/match/${m.code}`}
            className="group overflow-hidden rounded-2xl border-2 border-fg/15 bg-bg-elevated shadow-[4px_4px_0_rgba(11,32,48,.08)] transition-all hover:-translate-y-1 hover:border-brand/40 hover:shadow-lg"
          >
            {/* Scoreboard strip */}
            <div className="pitch-bg flex items-center justify-between gap-2 px-5 py-4 text-sm font-bold text-white">
              <span className="truncate text-right flex-1">{m.homeName}</span>
              <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest">
                <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-red-400" />
                Live
              </span>
              <span className="truncate flex-1">{m.awayName}</span>
            </div>
            {/* Score */}
            <div className="px-5 py-4 text-center">
              <p className="text-4xl font-black tabular-nums text-fg">
                {m.homeScore}<span className="text-subtle"> – </span>{m.awayScore}
              </p>
              <p className="mt-1 text-xs text-muted">
                Code <span className="font-semibold text-brand">{m.code}</span> · tap to watch &amp; answer
              </p>
            </div>

            {o ? (
              <div className="border-t border-line bg-surface px-5 py-3">
                <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-subtle">
                  <span>{o.phase === "PRE" ? "Match odds" : "In-play odds"}</span>
                  <span>display only</span>
                </div>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-center">
                  {[
                    { label: m.homeName, short: "1", value: o.home },
                    { label: "Draw", short: "X", value: o.draw },
                    { label: m.awayName, short: "2", value: o.away },
                  ].map((row) => (
                    <span
                      key={row.short}
                      className="rounded-lg border border-line bg-white px-1.5 py-1"
                      title={`${row.label} ${row.value}`}
                    >
                      <span className="block text-[9px] font-black uppercase text-subtle">{row.short}</span>
                      <span className="block text-sm font-black tabular-nums text-fg">{row.value}</span>
                    </span>
                  ))}
                </div>
                <div className="mt-1.5 flex justify-center gap-1.5 text-center">
                  <span className="rounded-lg border border-line bg-white px-2 py-1">
                    <span className="block text-[9px] font-black uppercase text-subtle">Over 2.5</span>
                    <span className="block text-xs font-black tabular-nums text-fg">{o.over25}</span>
                  </span>
                  <span className="rounded-lg border border-line bg-white px-2 py-1">
                    <span className="block text-[9px] font-black uppercase text-subtle">Under 2.5</span>
                    <span className="block text-xs font-black tabular-nums text-fg">{o.under25}</span>
                  </span>
                  <span className="rounded-lg border border-line bg-white px-2 py-1">
                    <span className="block text-[9px] font-black uppercase text-subtle">BTTS</span>
                    <span className="block text-xs font-black tabular-nums text-fg">{o.bttsYes}</span>
                  </span>
                </div>
              </div>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
