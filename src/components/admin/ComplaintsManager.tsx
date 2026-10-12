"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { resolveComplaintAction } from "@/app/actions/complaints";
import { Badge, Button, Textarea, cn } from "@/components/ui";

export type ComplaintRow = {
  id: string;
  type: string;
  subject: string;
  message: string;
  status: "OPEN" | "RESOLVED" | "DISMISSED";
  adminNote: string | null;
  createdAt: string;
  playerName: string;
  playerEmail: string;
  fixture: { code: string; label: string } | null;
};

const TYPE_LABEL: Record<string, string> = {
  MATCH_DECISION: "Referee decision",
  PLAYER_CONDUCT: "Player conduct",
  TECHNICAL: "Technical issue",
  OTHER: "Something else",
};

const FILTERS = ["OPEN", "RESOLVED", "DISMISSED", "ALL"] as const;

const STATUS_TONE = { OPEN: "warning", RESOLVED: "success", DISMISSED: "neutral" } as const;

export function ComplaintsManager({ complaints }: { complaints: ComplaintRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]>("OPEN");
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const shown = complaints.filter((c) => (filter === "ALL" ? true : c.status === filter));

  async function decide(id: string, outcome: "RESOLVED" | "DISMISSED") {
    setBusyId(id);
    setError(null);
    const r = await resolveComplaintAction(id, outcome, notes[id]);
    setBusyId(null);
    if (r.ok) router.refresh();
    else setError(r.error);
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors",
              filter === f ? "border-brand bg-brand/10 text-brand-deep" : "border-line bg-surface text-muted hover:text-fg",
            )}
          >
            {f === "OPEN" ? `Under review (${complaints.filter((c) => c.status === "OPEN").length})` : f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {error ? <p className="mt-3 text-xs font-medium text-danger">{error}</p> : null}

      {shown.length === 0 ? (
        <p className="mt-4 rounded-2xl border-2 border-dashed border-fg/20 bg-bg-elevated p-10 text-center text-sm text-muted">
          No complaints in this view.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {shown.map((c) => (
            <li key={c.id} className="rounded-2xl border-2 border-fg/15 bg-bg-elevated p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={STATUS_TONE[c.status]}>{c.status === "OPEN" ? "Under review" : c.status}</Badge>
                  <Badge tone="neutral">{TYPE_LABEL[c.type] ?? c.type}</Badge>
                  {c.fixture ? (
                    <Link href={`/match/${c.fixture.code}`} className="text-[11px] font-bold text-brand hover:underline">
                      {c.fixture.label}
                    </Link>
                  ) : (
                    <span className="text-[11px] text-subtle">No fixture</span>
                  )}
                </div>
                <span className="text-[10px] text-subtle">
                  {new Date(c.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>

              <p className="mt-2 text-sm font-bold text-fg">{c.subject}</p>
              <p className="mt-0.5 text-sm text-muted">{c.message}</p>
              <p className="mt-1 text-[11px] text-subtle">
                Filed by <span className="font-semibold text-fg">{c.playerName}</span> ({c.playerEmail})
              </p>

              {c.status === "OPEN" ? (
                <div className="mt-3 border-t border-line pt-3">
                  <Textarea
                    value={notes[c.id] ?? ""}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    rows={2}
                    maxLength={1000}
                    placeholder="Reply note for the player (optional)…"
                  />
                  <div className="mt-2 flex gap-2">
                    <Button variant="primary" loading={busyId === c.id} onClick={() => void decide(c.id, "RESOLVED")}>
                      ✓ Mark resolved
                    </Button>
                    <Button variant="ghost" loading={busyId === c.id} onClick={() => void decide(c.id, "DISMISSED")}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              ) : c.adminNote ? (
                <p className="mt-2 rounded-lg bg-brand/5 px-2.5 py-1.5 text-xs text-brand-deep">
                  <span className="font-black">Admin note:</span> {c.adminNote}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
