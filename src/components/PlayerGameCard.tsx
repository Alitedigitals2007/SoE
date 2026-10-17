"use client";

import * as React from "react";
import { Avatar } from "@/components/Avatar";
import { Badge, cn } from "@/components/ui";
import type { PlayerStats } from "@/lib/stats/player";

type TeamBadge = { name: string; slug: string };

type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic";

const RARITY: Record<
  Rarity,
  { label: string; tone: "neutral" | "info" | "warning" | "gold" | "danger"; border: string; glow: string; bg: string }
> = {
  common: {
    label: "Common",
    tone: "neutral",
    border: "border-white/30",
    glow: "shadow-[0_18px_40px_rgba(30,41,59,.45)]",
    bg: "bg-gradient-to-br from-slate-500 via-slate-600 to-slate-900",
  },
  rare: {
    label: "Rare",
    tone: "info",
    border: "border-emerald-300/70",
    glow: "shadow-[0_18px_45px_rgba(8,122,85,.55)]",
    bg: "bg-gradient-to-br from-emerald-400 via-teal-600 to-teal-950",
  },
  epic: {
    label: "Epic",
    tone: "warning",
    border: "border-amber-300/80",
    glow: "shadow-[0_18px_48px_rgba(217,139,17,.6)]",
    bg: "bg-gradient-to-br from-amber-400 via-orange-500 to-orange-950",
  },
  legendary: {
    label: "Legendary",
    tone: "gold",
    border: "border-yellow-200/90",
    glow: "shadow-[0_18px_52px_rgba(234,179,8,.65)]",
    bg: "bg-gradient-to-br from-yellow-300 via-amber-500 to-amber-900",
  },
  mythic: {
    label: "Mythic",
    tone: "danger",
    border: "border-fuchsia-300/80",
    glow: "shadow-[0_18px_56px_rgba(190,30,45,.7)]",
    bg: "bg-gradient-to-br from-fuchsia-500 via-rose-600 to-indigo-950",
  },
};

/** Performance-driven rating, clamped to 40–115. */
function ratingOf(stats: PlayerStats): number {
  const raw = stats.goals * 3 + stats.assists * 2 + stats.motm * 5 - stats.redCards * 2 - stats.yellowCards;
  return Math.min(115, Math.max(40, raw));
}

function rarityOf(rating: number): Rarity {
  if (rating >= 100) return "mythic";
  if (rating >= 90) return "legendary";
  if (rating >= 75) return "epic";
  if (rating >= 60) return "rare";
  return "common";
}

/** Market value derived purely from on-pitch performance (virtual points). */
function marketValueOf(stats: PlayerStats): number {
  return ratingOf(stats) * 10;
}

function ringFor(rarity: Rarity): string {
  if (rarity === "common") return "ring-4 ring-white/40";
  if (rarity === "rare") return "ring-4 ring-emerald-300/60";
  if (rarity === "epic") return "ring-4 ring-amber-300/60";
  if (rarity === "legendary") return "ring-4 ring-yellow-200/70";
  return "ring-4 ring-fuchsia-300/70";
}

const SHINE = "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_-8%,rgba(255,255,255,.35),transparent_45%)]";

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
  const rating = ratingOf(stats);
  const rarity = rarityOf(rating);
  const style = RARITY[rarity];
  const value = marketValueOf(stats);
  const [flipped, setFlipped] = React.useState(false);

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
        <div
          className={cn(
            "player-card-face player-card-front overflow-hidden rounded-3xl border-2 p-5 text-white",
            style.bg,
            style.border,
            style.glow,
          )}
        >
          <span aria-hidden className={SHINE} />

          <div className="relative flex items-start justify-between gap-3">
            <span className="text-4xl font-black italic leading-none tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,.45)]">
              {rating}
            </span>
            <span className="max-w-[55%] truncate rounded-md bg-black/30 px-2 py-1 text-[10px] font-black uppercase tracking-widest">
              {stats.motm > 0 ? `🏅 ×${stats.motm} MOTM` : "Player card"}
            </span>
          </div>

          <div className="relative mt-3 flex items-center justify-center">
            <div className={cn("rounded-full p-1", ringFor(rarity))}>
              <Avatar name={name} src={imageUrl} size={96} className="!ring-0 rounded-full" />
            </div>
          </div>

          <p className="relative mt-3 w-full truncate text-center text-xl font-black uppercase leading-tight tracking-wide">
            {name}
          </p>
          <p className="relative mt-0.5 w-full truncate text-center text-[11px] font-semibold uppercase tracking-widest text-white/80">
            {teams[0]?.name ?? "Free agent"}
            {teams.length > 1 ? ` +${teams.length - 1}` : ""}
          </p>

          <div className="relative mt-4 grid grid-cols-4 gap-2 rounded-xl border border-white/25 bg-black/25 p-3 text-center">
            {[
              { label: "Goals", value: stats.goals },
              { label: "Assists", value: stats.assists },
              { label: "Games", value: stats.matches },
              { label: "Wins", value: wins },
            ].map((s) => (
              <div key={s.label} className="min-w-0">
                <p className="truncate text-lg font-black tabular-nums text-white">{s.value}</p>
                <p className="truncate text-[9px] font-bold uppercase tracking-widest text-white/75">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="relative mt-3 rounded-xl border-2 border-white/30 bg-black/30 px-3 py-2 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/80">Value</p>
            <p className="text-sm font-black tabular-nums text-white">{value} pts</p>
          </div>

          <div className="relative mt-2 flex items-center justify-center gap-2">
            <Badge tone={style.tone}>{style.label}</Badge>
            <span className="text-[10px] text-white/70">rating {rating}</span>
          </div>

          <p className="relative mt-3 text-center text-[10px] text-white/70">Tap the card to flip →</p>
        </div>

        {/* ---------------------------- BACK ----------------------------- */}
        <div
          className={cn(
            "player-card-face player-card-back absolute inset-0 overflow-hidden rounded-3xl border-2 p-5 [transform:rotateY(180deg)]",
            style.bg,
            style.border,
            style.glow,
          )}
        >
          <span aria-hidden className="pointer-events-none absolute inset-0 bg-black/45" />
          <span aria-hidden className={SHINE} />

          <div className="relative flex h-full flex-col text-white">
            <div className="mb-2 flex items-start justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/70">Full performance</span>
              <Badge tone={style.tone}>{style.label}</Badge>
            </div>
            <p className="mb-3 w-full truncate text-lg font-black">{name}</p>

            <dl className="grid grid-cols-2 gap-x-3">
              {[
                { label: "Matches", value: String(matches) },
                { label: "Goals", value: `${stats.goals}${stats.goalShare !== null ? ` · ${stats.goalShare}%` : ""}` },
                { label: "Assists", value: `${stats.assists}${stats.assistShare !== null ? ` · ${stats.assistShare}%` : ""}` },
                { label: "Side goals", value: String(stats.teamGoals) },
                { label: "Side assists", value: String(stats.teamAssists) },
                { label: "MOTM", value: String(stats.motm) },
                { label: "Yellow cards", value: String(stats.yellowCards) },
                { label: "Red cards", value: String(stats.redCards) },
                { label: "Warnings", value: String(stats.warnings) },
                { label: "Rating", value: String(rating) },
                { label: "Value", value: `${value} pts` },
                { label: "Rarity", value: style.label },
              ].map((row) => (
                <div key={row.label} className="flex min-w-0 items-center justify-between gap-1 border-b border-white/15 py-1">
                  <dt className="truncate text-[11px] text-white/70">{row.label}</dt>
                  <dd className="shrink-0 text-xs font-black tabular-nums">{row.value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge tone={stats.goalShare !== null ? "gold" : "neutral"} className="!text-[10px]">
                Goal share {stats.goalShare !== null ? `${stats.goalShare}%` : "—"}
              </Badge>
              <Badge tone={stats.assistShare !== null ? "info" : "neutral"} className="!text-[10px]">
                Assist share {stats.assistShare !== null ? `${stats.assistShare}%` : "—"}
              </Badge>
            </div>

            <p className="mt-auto pt-2 text-center text-[10px] text-white/70">Tap to flip back</p>
          </div>
        </div>
      </button>
    </div>
  );
}
