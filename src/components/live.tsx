"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Live scoreboard with client-side auto-refresh (poll the RSC payload every few
 * seconds) so the "Live now" page behaves like a live stream without a reload.
 */
export function MatchLiveCard({ matches }: { matches: { id: string; code: string; homeName: string; awayName: string; homeScore: number; awayScore: number }[] }) {
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
      {matches.map((m) => (
        <Link
          key={m.id}
          href={`/match/${m.code}`}
          className="group overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition-all hover:-translate-y-1 hover:border-brand/40 hover:shadow-lg"
        >
          <div className="pitch-bg flex items-center justify-between gap-2 px-5 py-4 text-sm font-bold text-white">
            <span className="truncate">{m.homeName}</span>
            <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest">
              <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-red-400" />
              Live
            </span>
            <span className="truncate text-right">{m.awayName}</span>
          </div>
          <div className="px-5 py-4 text-center">
            <p className="text-4xl font-black tabular-nums text-fg">
              {m.homeScore}<span className="text-subtle"> – </span>{m.awayScore}
            </p>
            <p className="mt-1 text-xs text-muted">
              Code <span className="font-semibold text-brand">{m.code}</span> · tap to watch & answer
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
