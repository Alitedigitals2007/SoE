"use client";

import * as React from "react";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/ui";
import type { PlayerStats } from "@/lib/stats/player";

type TeamBadge = { name: string; slug: string };

/**
 * FIFA-style player card with a CSS-3D flip: the front shows the photo,
 * rating and headline numbers; the back holds the full breakdown with the
 * player's contribution percentages to their side's output.
 */
export function PlayerGameCard({
  name,
  imageUrl,
  teams,
  matches,
  wins,
  stats,
}: {
  name: string;
  imageUrl: string | null;
  teams: TeamBadge[];
  matches: number;
  wins: number;
  stats: PlayerStats;
}) {
  const [flipped, setFlipped] = React.useState(false);

  // Overall rating — goals and assists drive it, MOTM crowns it (cap 99).
  const rating = Math.min(
    99,
    60 + stats.goals * 3 + stats.assists * 2 + stats.motm * 5 - stats.redCards * 2,
  );

  return (
    <div className="player-card-scene mx-auto w-full max-w-sm" style={{ perspective: "1100px" }}>
      <button
        type="button"
        onClick={() => setFlipped((v) => !v)}
        aria-pressed={flipped}
        aria-label={`Player card for ${name} — tap to flip and see the full stats`}
        className="player-card block w-full text-left"
        data-flipped={flipped}
      >
        {/* ---------------------------- FRONT ---------------------------- */}
        <div className="player-card-face player-card-front rounded-3xl border-2 border-gold/50 bg-gradient-to-br from-brand via-brand-deep to-fg p-5 text-white shadow-[0_18px_40px_rgba(11,32,48,.35)]">
          <div className="flex items-start justify-between">
            <span className="text-3xl font-black italic tracking-tight opacity-90">{rating}</span>
            <span className="rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest">
              {stats.motm > 0 ? `🏅 ×${stats.motm} MOTM` : "Player card"}
            </span>
          </div>

          <div className="mt-2 flex items-center justify-center">
            <div className="rounded-full ring-4 ring-white/25">
              <Avatar name={name} src={imageUrl} size={96} className="!ring-0" />
            </div>
          </div>

          <p className="mt-3 text-center text-xl font-black uppercase leading-tight tracking-wide">{name}</p>
          <p className="mt-0.5 text-center text-[11px] font-semibold uppercase tracking-widest text-white/75">
            {teams[0]?.name ?? "Free agent"}
            {teams.length > 1 ? ` +${teams.length - 1}` : ""}
          </p>

          <div className="mt-4 grid grid-cols-4 gap-2 rounded-xl bg-white/10 p-3 text-center">
            {[
              { label: "Goals", value: stats.goals },
              { label: "Assists", value: stats.assists },
              { label: "Games", value: stats.matches },
              { label: "Wins", value: wins },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-lg font-black tabular-nums">{s.value}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/70">{s.label}</p>
              </div>
            ))}
          </div>

          <p className="mt-3 text-center text-[10px] text-white/60">Tap the card to flip →</p>
        </div>

        {/* ---------------------------- BACK ----------------------------- */}
        <div className="player-card-face player-card-back absolute inset-0 rounded-3xl border-2 border-line-strong bg-bg-elevated p-5 shadow-[0_18px_40px_rgba(11,32,48,.25)] [transform:rotateY(180deg)]">
          <p className="text-[10px] font-black uppercase tracking-widest text-gold-strong">Full performance</p>
          <p className="truncate text-lg font-black text-fg">{name}</p>

          <dl className="mt-3 space-y-1.5 text-sm">
            {[
              { label: "Matches played", value: matches },
              { label: "Goals", value: `${stats.goals}${stats.goalShare !== null ? ` · ${stats.goalShare}% of side` : ""}` },
              { label: "Assists", value: `${stats.assists}${stats.assistShare !== null ? ` · ${stats.assistShare}% of side` : ""}` },
              { label: "Side goals", value: stats.teamGoals },
              { label: "Side assists", value: stats.teamAssists },
              { label: "MOTM awards", value: stats.motm },
              { label: "Yellow cards", value: stats.yellowCards },
              { label: "Red cards", value: stats.redCards },
              { label: "Warnings", value: stats.warnings },
            ].map((row) => (
              <div key={row.label} className="flex justify-between border-b border-line/60 py-1">
                <dt className="text-muted">{row.label}</dt>
                <dd className="font-bold tabular-nums text-fg">{row.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone={stats.goalShare !== null ? "gold" : "neutral"} className="!text-[10px]">
              Goal contribution {stats.goalShare !== null ? `${stats.goalShare}%` : "—"}
            </Badge>
            <Badge tone={stats.assistShare !== null ? "info" : "neutral"} className="!text-[10px]">
              Assist contribution {stats.assistShare !== null ? `${stats.assistShare}%` : "—"}
            </Badge>
          </div>

          <p className="mt-3 text-center text-[10px] text-subtle">Tap to flip back</p>
        </div>
      </button>
    </div>
  );
}
