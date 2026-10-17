"use client";

import * as React from "react";
import { Avatar } from "@/components/Avatar";
import { Badge, cn } from "@/components/ui";
import type { PlayerStats } from "@/lib/stats/player";

type TeamBadge = { name: string; slug: string };

type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic";

const RARITY: Record<Rarity, { label: string; tone: "neutral" | "info" | "warning" | "gold" | "danger"; border: string; glow: string }> = {
  common: { label: "Common", tone: "neutral", border: "border-line", glow: "shadow-[0_0_20px_rgba(150,150,160,.35)]" },
  rare: { label: "Rare", tone: "info", border: "border-info/60", glow: "shadow-[0_0_24px_rgba(8,122,85,.45)]" },
  epic: { label: "Epic", tone: "warning", border: "border-warning/70", glow: "shadow-[0_0_28px_rgba(217,139,17,.55)]" },
  legendary: { label: "Legendary", tone: "gold", border: "border-gold/80", glow: "shadow-[0_0_32px_rgba(234,179,8,.65)]" },
  mythic: { label: "Mythic", tone: "danger", border: "border-danger/80", glow: "shadow-[0_0_36px_rgba(190,30,45,.75)]" },
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
  if (rarity === "common") return "ring-2 ring-white/35";
  if (rarity === "rare") return "ring-4 ring-info/50";
  if (rarity === "epic") return "ring-4 ring-warning/50";
  if (rarity === "legendary") return "ring-4 ring-gold/50";
  return "ring-4 ring-danger/50";
}

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
            "player-card-face player-card-front rounded-3xl p-5 text-white shadow-[0_18px_40px_rgba(11,32,48,.35)]",
            style.border,
            style.glow,
            rarity === "mythic" ? "border-4" : "border-2",
          )}
        >
          <div className="flex items-start justify-between">
            <span className="text-3xl font-black italic tracking-tight opacity-90">{rating}</span>
            <span className="rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest">
              {stats.motm > 0 ? `🏅 ×${stats.motm} MOTM` : "Player card"}
            </span>
          </div>

          <div className="mt-2 flex items-center justify-center">
            <div className={cn("rounded-full p-1", ringFor(rarity))}>
              <Avatar name={name} src={imageUrl} size={96} className="!ring-0 rounded-full" />
            </div>
          </div>

          <p className="mt-3 text-center text-xl font-black uppercase leading-tight tracking-wide truncate max-w-[160px] mx-auto">{name}</p>
          <p className="mt-0.5 text-center text-[11px] font-semibold uppercase tracking-widest text-white/75 truncate max-w-[160px] mx-auto">
            {teams[0]?.name ?? "Free agent"}
            {teams.length > 1 ? ` +${teams.length - 1}` : ""}
          </p>

          <div className="mt-4 grid grid-cols-4 gap-2 rounded-xl bg-white/15 p-3 text-center border border-white/20">
            {[
              { label: "Goals", value: stats.goals },
              { label: "Assists", value: stats.assists },
              { label: "Games", value: stats.matches },
              { label: "Wins", value: wins },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-lg font-black tabular-nums text-white">{s.value}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/80">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-xl border-2 border-white/30 bg-white/20 px-3 py-2 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/80">Value</p>
            <p className="text-sm font-black tabular-nums text-white">{value} pts</p>
          </div>

          <div className="mt-2 flex items-center justify-center gap-2">
            <Badge tone={style.tone}>{style.label}</Badge>
            <span className="text-[10px] text-white/60">rating {rating}</span>
          </div>

          <p className="mt-3 text-center text-[10px] text-white/60">Tap the card to flip →</p>
        </div>

        {/* ---------------------------- BACK ----------------------------- */}
        <div
          className={cn(
            "player-card-face player-card-back absolute inset-0 rounded-3xl p-6 shadow-[0_20px_50px_rgba(11,32,48,.4)] [transform:rotateY(180deg)]",
            style.border,
            rarity === "mythic" ? "border-4" : "border-2",
            rarity === "common" ? "bg-white/5" : rarity === "rare" ? "bg-white/10" : "bg-white/15",
          )}
        >
          <div className="flex items-start justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted opacity-80">Full performance</span>
            <Badge tone={style.tone} className="shadow-sm">{style.label}</Badge>
          </div>
          <p className="truncate text-xl font-black text-fg mb-4">{name}</p>

          <dl className="space-y-2">
            {[
              { label: "Matches played", value: String(matches) },
              { label: "Goals", value: `${stats.goals}${stats.goalShare !== null ? ` · ${stats.goalShare}%` : ""}` },
              { label: "Assists", value: `${stats.assists}${stats.assistShare !== null ? ` · ${stats.assistShare}%` : ""}` },
              { label: "Side goals", value: String(stats.teamGoals) },
              { label: "Side assists", value: String(stats.teamAssists) },
              { label: "MOTM awards", value: String(stats.motm) },
              { label: "Yellow cards", value: String(stats.yellowCards) },
              { label: "Red cards", value: String(stats.redCards) },
              { label: "Warnings", value: String(stats.warnings) },
              { label: "Rating", value: String(rating) },
              { label: "Rarity", value: style.label },
              { label: "Value", value: `${value} pts` },
            ].map((row) => (
              <div key={row.label} className="flex justify-between border-b border-white/25 py-1.5 last:border-0">
                <dt className="text-muted text-sm">{row.label}</dt>
                <dd className="font-black tabular-nums text-white">{row.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 flex flex-wrap gap-1.5">
            <Badge tone={stats.goalShare !== null ? "gold" : "neutral"} className="!text-[10px] shadow-sm">
              Goal contribution {stats.goalShare !== null ? `${stats.goalShare}%` : "—"}
            </Badge>
            <Badge tone={stats.assistShare !== null ? "info" : "neutral"} className="!text-[10px] shadow-sm">
              Assist contribution {stats.assistShare !== null ? `${stats.assistShare}%` : "—"}
            </Badge>
          </div>

          <p className="mt-5 text-center text-[10px] text-muted opacity-70">Tap to flip back</p>
        </div>
      </button>
    </div>
  );
}
