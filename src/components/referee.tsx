"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  addQuestionAction,
  kickOffAction,
  removeQuestionAction,
  setLineupAction,
  setQuestionSlotAction,
  updateQuestionAction,
} from "@/app/actions/match";
import { Badge, Button, Card, CardHeader, Field, Input, Select } from "@/components/ui";
import type { TeamSide } from "@/lib/domain";
import { cn } from "@/components/ui";

type Notice = { kind: "ok" | "err"; text: string } | null;

/* ------------------------------ questions bank ----------------------------- */

export type QRow = { id: string; order: number; text: string; referenceAnswer: string; roundNumber: number | null };

const SLOT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function QuestionsManager({ code, questions }: { code: string; questions: QRow[] }) {
  const router = useRouter();
  const [notice, setNotice] = React.useState<Notice>(null);
  const [text, setText] = React.useState("");
  const [ref, setRef] = React.useState("");
  const [editing, setEditing] = React.useState<string | null>(null);

  function flash(r: { ok: boolean; error?: string }, t: string) {
    if (r.ok) {
      setNotice({ kind: "ok", text: t });
      router.refresh();
    } else {
      setNotice({ kind: "err", text: r.error ?? "Action failed." });
    }
  }

  const inBank = questions.length;
  const selected = questions.filter((q) => q.roundNumber != null).length;

  return (
    <Card>
      <CardHeader
        title="The twenty"
        description={`Prepare up to 20 questions, then place the ten that will be played into slots 1–10. (${selected}/10 placed) · ${inBank} prepared`}
        aside={<Badge tone={inBank >= 10 && selected === 10 ? "pitch" : "warning"}>{inBank < 20 ? `${inBank} prepared` : "Full bank"}</Badge>}
      />

      <form
        className="grid gap-3 border-b border-line p-4 md:grid-cols-[1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          void addQuestionAction({ code, text, referenceAnswer: ref }).then((r) => {
            if (r.ok) {
              setText("");
              setRef("");
            }
            flash(r, "Question added.");
          });
        }}
      >
        <Field label="Question">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="What is the SI unit of force?" />
        </Field>
        <Field label="Reference answer">
          <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Newton" />
        </Field>
        <div className="flex items-end">
          <Button type="submit" disabled={!text.trim() || !ref.trim()}>
            Add question
          </Button>
        </div>
      </form>

      {notice ? <NoticeLine notice={notice} /> : null}

      <ul className="divide-y divide-line/70">
        {questions.length === 0 ? (
          <li className="p-6 text-center text-sm text-muted">
            No questions prepared. Add your first above.
            <p className="mt-1 text-xs text-subtle">Each match prepares 20; only the 10 you place in slots 1–10 get played.</p>
          </li>
        ) : (
          questions.map((q) => {
            const isEditing = editing === q.id;
            return (
              <li key={q.id} className="px-4 py-3">
                {isEditing ? (
                  <EditQuestionForm code={code} q={q} onDone={() => setEditing(null)} flash={flash} />
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="w-7 shrink-0 text-right text-sm font-bold tabular-nums text-subtle">{q.order}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-fg">{q.text}</p>
                      <p className="text-xs text-muted">
                        Ref answer: <span className="text-gold">{q.referenceAnswer}</span>
                      </p>
                    </div>
                    <Select
                      aria-label={`Play slot for question ${q.order}`}
                      className="h-9 w-40 py-1 text-xs"
                      value={q.roundNumber ?? 0}
                      onChange={(e) => {
                        const slot = Number(e.target.value);
                        void setQuestionSlotAction({ code, questionId: q.id, roundNumber: slot === 0 ? null : slot }).then((r) => flash(r, "Play slot updated."));
                      }}
                    >
                      <option value={0}>Bank only</option>
                      {SLOT_OPTIONS.map((n) => (
                        <option key={n} value={n}>
                          Slot {n} — Question {n}/10
                        </option>
                      ))}
                    </Select>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => setEditing(q.id)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void removeQuestionAction({ code, questionId: q.id }).then((r) => flash(r, "Question removed."))}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })
        )}
      </ul>
    </Card>
  );
}

function EditQuestionForm({
  code,
  q,
  onDone,
  flash,
}: {
  code: string;
  q: QRow;
  onDone: () => void;
  flash: (r: { ok: boolean; error?: string }, t: string) => void;
}) {
  const [text, setText] = React.useState(q.text);
  const [ref, setRef] = React.useState(q.referenceAnswer);
  return (
    <form
      className="grid gap-2 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        void updateQuestionAction({ code, questionId: q.id, text, referenceAnswer: ref }).then((r) => {
          flash(r, "Question updated.");
          if (r.ok) onDone();
        });
      }}
    >
      <Field label="Question">
        <Input value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      <div className="flex items-end gap-2">
        <Field label="Reference answer" className="flex-1">
          <Input value={ref} onChange={(e) => setRef(e.target.value)} />
        </Field>
        <Button type="submit" size="sm">
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/* -------------------------------- line-ups -------------------------------- */

export type LineupPlayer = { userId: string; name: string; number: number; role: "STARTER" | "SUB" | "OUT"; isCaptain: boolean };

export function LineupManager({
  code,
  homeName,
  awayName,
  teams,
}: {
  code: string;
  homeName: string;
  awayName: string;
  teams: Record<TeamSide, LineupPlayer[]>;
}) {
  const router = useRouter();
  const [notice, setNotice] = React.useState<Notice>(null);
  const [kickingOff, setKickingOff] = React.useState(false);

  function flash(r: { ok: boolean; error?: string }, t: string) {
    if (r.ok) {
      setNotice({ kind: "ok", text: t });
      router.refresh();
    } else {
      setNotice({ kind: "err", text: r.error ?? "Action failed." });
    }
  }

  const homeOk = countStarter(teams.HOME) === 5 && !!teams.HOME.find((p) => p.isCaptain);
  const awayOk = countStarter(teams.AWAY) === 5 && !!teams.AWAY.find((p) => p.isCaptain);
  const rosterFull = (teams.HOME.length + teams.AWAY.length) >= 10;

  return (
    <div className="space-y-4">
      {notice ? <NoticeLine notice={notice} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <TeamLineupEditor side="HOME" name={homeName} tone="teama" code={code} players={teams.HOME} flash={flash} />
        <TeamLineupEditor side="AWAY" name={awayName} tone="teamb" code={code} players={teams.AWAY} flash={flash} />
      </div>

      <Card>
        <CardHeader title="Kick-off" description="Starts the live match. Both teams need 5 starters + a captain, and all ten question slots must be filled." />
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <Check label="Team A ready" ok={homeOk} />
            <Check label="Team B ready" ok={awayOk} />
            <Check label="Roster populated" ok={rosterFull} />
          </div>
          <div className="ml-auto">
            <Button
              variant="pitch"
              loading={kickingOff}
              disabled={!rosterFull}
              onClick={() => {
                if (kickingOff) return;
                setKickingOff(true);
                setNotice(null);
                void kickOffAction(code).then((r) => {
                  if (r.ok) {
                    router.replace(`/match/${code}`);
                  } else {
                    setNotice({ kind: "err", text: r.error });
                  }
                }).finally(() => setKickingOff(false));
              }}
            >
              🏟️ Kick off {homeName} v {awayName}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function countStarter(players: LineupPlayer[]) {
  return players.filter((p) => p.role === "STARTER").length;
}

function TeamLineupEditor({
  side,
  name,
  tone,
  code,
  players,
  flash,
}: {
  side: TeamSide;
  name: string;
  tone: "teama" | "teamb";
  code: string;
  players: LineupPlayer[];
  flash: (r: { ok: boolean; error?: string }, t: string) => void;
}) {
  const [selected, setSelected] = React.useState<string[]>(() => players.filter((p) => p.role === "STARTER").map((p) => p.userId));
  const [captain, setCaptain] = React.useState<string>(() => players.find((p) => p.isCaptain)?.userId ?? "");
  const [busy, setBusy] = React.useState(false);
  const sorted = [...players].sort((a, b) => a.number - b.number);
  const toneText = tone === "teama" ? "text-teama" : "text-teamb";
  const toneOn = tone === "teama" ? "border-teama/60 bg-teama/10" : "border-teamb/60 bg-teamb/10";

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) {
        if (captain === id) setCaptain("");
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  }

  return (
    <Card className={cn("h-fit", "border")}>
      <CardHeader title={name} description={side === "HOME" ? "Team A · pick 5 starters and the captain" : "Team B · pick 5 starters and the captain"} aside={<Badge tone={tone as never}>{selected.length}/5</Badge>} />
      <div className="p-4">
        {players.length === 0 ? (
          <p className="text-sm text-subtle">No players assigned yet — the admin fills the roster.</p>
        ) : (
          <>
            <ul className="space-y-1.5">
              {sorted.map((p) => {
                const on = selected.includes(p.userId);
                return (
                  <li key={p.userId}>
                    <button
                      type="button"
                      onClick={() => toggle(p.userId)}
                      aria-pressed={on}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                        on ? toneOn : "border-line bg-bg-raised hover:border-line-strong",
                      )}
                    >
                      <span className={cn("w-4 text-right text-xs font-bold text-subtle")}>{p.number}</span>
                      <span className={cn("min-w-0 flex-1 truncate font-medium", on ? "text-fg" : "text-muted")}>{p.name}</span>
                      {on ? <Badge tone="pitch">Starter</Badge> : <Badge tone="neutral">Bench</Badge>}
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-muted">
                Captain
                <Select className={cn("h-9 py-1", toneText)} value={captain} onChange={(e) => setCaptain(e.target.value)}>
                  <option value="">Choose…</option>
                  {sorted.filter((p) => selected.includes(p.userId)).map((p) => (
                    <option key={p.userId} value={p.userId}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </label>
              <Button
                variant="secondary"
                loading={busy}
                disabled={selected.length !== 5 || !captain || busy}
                onClick={() => {
                  setBusy(true);
                  void setLineupAction({ code, team: side, captainUserId: captain, starterIds: selected }).then((r) => {
                    flash(r, `${name} line-up saved.`);
                  }).finally(() => setBusy(false));
                }}
              >
                Save {name}
              </Button>
            </div>
            <p className={cn("mt-2 text-[10px] font-bold uppercase tracking-widest", toneText)}>
              {countStarter(players)} starter{countStarter(players) === 1 ? "" : "s"} currently saved
            </p>
          </>
        )}
      </div>
    </Card>
  );
}

function Check({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium", ok ? "border-success/40 text-success" : "border-line-strong text-subtle")}>
      <span aria-hidden>{ok ? "✓" : "•"}</span>
      {label}
    </span>
  );
}

function NoticeLine({ notice }: { notice: Notice }) {
  return (
    <p
      role={notice?.kind === "err" ? "alert" : "status"}
      className={notice?.kind === "err" ? "rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger" : "rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"}
    >
      {notice?.text}
    </p>
  );
}
