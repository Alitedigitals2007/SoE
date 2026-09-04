"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getOrCreateEntryAction, setFantasyPicksAction } from "@/app/actions/platform";
import { Button, cn } from "@/components/ui";

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

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          <span className="font-bold text-brand">{picked.length}</span>/{maxPicks} selected — 10 points per goal from a picked scorer.
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
        <div className="rounded-xl border border-dashed border-line-strong bg-white p-6 text-center text-sm text-muted">
          This competition has finished — picks are locked.
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {players.length === 0 ? (
            <p className="text-sm text-muted sm:col-span-2">
              No players available yet — teams need players on their rosters first.
            </p>
          ) : (
            players.map((p) => {
              const on = picked.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  aria-pressed={on}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors",
                    on ? "border-brand bg-brand/10" : "border-line bg-white hover:border-line-strong",
                  )}
                >
                  <span aria-hidden className={cn("grid size-5 shrink-0 place-items-center rounded-full border text-xs font-black", on ? "border-brand bg-brand text-white" : "border-line-strong text-transparent")}>
                    ✓
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-fg">{p.name}</span>
                    <span className="block truncate text-xs text-muted">{p.teams.join(", ")}</span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
