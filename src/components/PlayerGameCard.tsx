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

/** Performance-driven rating: uncapped — can fall below 60 or rise above 99. */
function ratingOf(stats: PlayerStats): number {
  return stats.goals * 3 + stats.assists * 2 + stats.motm * 5 - stats.redCards * 2 - stats.yellowCards;
}

function rarityOf(rating: number): Rarity {
  if (rating >= 100) return "mythic";
  if (rating >= 90) return "legendary";
  if (rating >= 75) return "epic";
  if (rating >= 60) return "rare";
  return "common";
}

export function PlayerGameCard({
  name,
  imageUrl,
  teams,
  matches,
  wins,
  stats,
  marketValue,
}: {
  name: string;
  imageUrl: string | null;
  teams: TeamBadge[];
  matches: number;
  wins: number;
  stats: PlayerStats;
  /** Transfer-market value in virtual points — separate from the account wallet. */
  marketValue?: number;
}) {
  const rating = ratingOf(stats);
  const rarity = rarityOf(rating);
  const style = RARITY[rarity];
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

          <div className="mt-3 rounded-xl border-2 border-white/20 bg-white/10 px-3 py-2 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Value</p>
            <p className="text-sm font-black tabular-nums text-white">{marketValue ?? 0} pts</p>
          </div>

          <div className="mt-2 flex items-center justify-center gap-2">
            <Badge tone={style.tone}>{style.label}</Badge>
            <span className="text-[10px] text-white/60">rating {rating}</span>
          </div>

          <p className="mt-3 text-center text-[10px] text-white/60">Tap the card to flip →</p>
        </div>

        {/* ---------------------------- BACK ----------------------------- */}
        <div className="player-card-face player-card-back absolute inset-0 rounded-3xl p-5 shadow-[0_18px_40px_rgba(11,32,48,.25)] [transform:rotateY(180deg)]">
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
              { label: "Rating", value: rating },
              { label: "Rarity", value: style.label },
              { label: "Value", value: `${marketValue ?? 0} pts` },
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
