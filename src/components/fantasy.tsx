"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getOrCreateEntryAction, setFantasyPicksAction } from "@/app/actions/platform";
import { Badge, Button, Input, cn } from "@/components/ui";

export type EligiblePlayer = { id: string; name: string; teams: string[] };

export function FantasyPicker({
  competitionId,
  players,
  existing,
  maxPicks,
  disabled,
}: {
  competitionId: string;
  players: EligiblePlayer[];
  existing: string[];
  maxPicks: number;
  disabled: boolean;
}) {
  const router = useRouter();
  const [picked, setPicked] = React.useState<string[]>(existing);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");

  const filtered = players.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  function toggle(id: string) {
    setError(null);
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= maxPicks) return prev;
      return [...prev, id];
    });
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await getOrCreateEntryAction(competitionId);
      if (!created.ok) {
        setError(created.error);
        return;
      }
      const r = await setFantasyPicksAction({ competitionId, playerIds: picked });
      if (!r.ok) setError(r.error);
      router.refresh();
    } catch (e) {
      console.error(e);
      setError("Could not save — please try again.");
    } finally {
      setBusy(false);
    }
  }

  const canPickMore = picked.length < maxPicks;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          <span className="font-bold text-brand">{picked.length}</span>/{maxPicks} selected · 10 points per goal from a picked scorer.
        </p>
        <Button size="sm" variant="primary" disabled={disabled || busy} loading={busy} onClick={() => void save()}>
          Save squad
        </Button>
      </div>

      {error ? (
        <p role="alert" className="mb-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {disabled ? (
        <div className="rounded-xl border-2 border-dashed border-fg/20 bg-bg-elevated p-6 text-center text-sm text-muted">
          This competition has finished — picks are locked.
        </div>
      ) : (
        <div className="mt-3">
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${players.length} eligible players…`}
            aria-label="Search eligible players"
            className="mb-3 max-w-sm"
          />
          {players.length === 0 ? (
            <p className="text-sm text-muted">No players available yet — teams need players on their rosters first.</p>
          ) : filtered.length === 0 ? (
            <p className="rounded-xl border-2 border-dashed border-fg/20 bg-bg-elevated p-6 text-center text-sm text-muted">
              No players match “{q}”.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {filtered.map((p) => {
                const on = picked.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    aria-pressed={on}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border-2 px-3.5 py-2.5 text-left shadow-[2px_2px_0_rgba(11,32,48,.05)] transition-all",
                      on ? "border-brand bg-brand/10" : "border-fg/15 bg-bg-elevated hover:-translate-y-0.5 hover:border-brand/40",
                    )}
                  >
                    <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-full text-sm font-black", on ? "bg-brand text-white" : "bg-surface text-brand")}>
                      {p.name.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-fg">{p.name}</span>
                      <span className="mt-0.5 flex flex-wrap gap-1">
                        {p.teams.slice(0, 2).map((t) => (
                          <Badge key={t} tone="neutral" className="!text-[9px]">
                            {t}
                          </Badge>
                        ))}
                        {p.teams.length > 2 ? <span className="text-[10px] text-subtle">+{p.teams.length - 2}</span> : null}
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-full border text-xs font-black transition-colors",
                        on ? "border-brand bg-brand text-white" : "border-line-strong text-transparent",
                      )}
                    >
                      ✓
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-subtle">
            {!canPickMore ? (
              <span className="font-semibold text-brand">Your XI is full — tap a picked player to swap.</span>
            ) : (
              <span>Tap a player to add them to your XI.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

