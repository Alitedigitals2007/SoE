"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  addQuestionAction,
  autoCompleteSetupAction,
  importQuestionsAction,
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

export type QuestionSource = { code: string; label: string; count: number };

const SLOT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Splits one line into question/answer: `q | a`, tab, or CSV (quoted or plain). */
function splitQuestionLine(line: string): [string, string] | null {
  const quoted = line.match(/^"((?:[^"]|"")*)"\s*[,\t|]\s*"((?:[^"]|"")*)"\s*$/);
  if (quoted) return [quoted[1].replace(/""/g, '"'), quoted[2].replace(/""/g, '"')];
  const sep = line.includes("|") ? "|" : line.includes("\t") ? "\t" : line.includes(",") ? "," : null;
  if (!sep) return null;
  const idx = line.indexOf(sep);
  return [line.slice(0, idx), line.slice(idx + sep.length)];
}

const normalizeQuestion = (t: string) => t.trim().toLowerCase().replace(/\s+/g, " ");

export function QuestionsManager({
  code,
  questions,
  sources = [],
}: {
  code: string;
  questions: QRow[];
  sources?: QuestionSource[];
}) {
  const router = useRouter();
  const [notice, setNotice] = React.useState<Notice>(null);
  const [text, setText] = React.useState("");
  const [ref, setRef] = React.useState("");
  const [editing, setEditing] = React.useState<string | null>(null);
  const [bulk, setBulk] = React.useState("");
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [sourceCode, setSourceCode] = React.useState("");
  const [importing, setImporting] = React.useState(false);

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

  function parseBulk(raw: string): { ok: boolean; errors: string[]; items: { text: string; ref: string }[] } {
    const items: { text: string; ref: string }[] = [];
    const errors: string[] = [];
    raw
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((line, idx) => {
        const parts = splitQuestionLine(line);
        const questionText = (parts?.[0] ?? "").trim();
        const answer = (parts?.[1] ?? "").trim();
        if (!questionText || !answer) {
          errors.push(`Line ${idx + 1}: use  Question | Answer  and fill both sides.`);
        } else {
          items.push({ text: questionText, ref: answer });
        }
      });
    return { ok: errors.length === 0, errors, items };
  }

  async function submitBulk() {
    if (bulkBusy) return;
    const { errors, items: parsed } = parseBulk(bulk);
    if (parsed.length === 0) {
      setNotice({ kind: "err", text: errors[0] ?? "Paste at least one question." });
      return;
    }
    const seen = new Set(questions.map((q) => normalizeQuestion(q.text)));
    const fresh: { text: string; ref: string }[] = [];
    let duplicates = 0;
    for (const item of parsed) {
      const key = normalizeQuestion(item.text);
      if (seen.has(key)) {
        duplicates++;
        continue;
      }
      seen.add(key);
      fresh.push(item);
    }
    if (fresh.length === 0) {
      setNotice({ kind: "err", text: "Every pasted question is already in the bank." });
      return;
    }
    if (inBank + fresh.length > 20) {
      setNotice({ kind: "err", text: `Only ${20 - inBank} more question(s) fit in the bank (you pasted ${fresh.length}).` });
      return;
    }
    setBulkBusy(true);
    let added = 0;
    let failed = 0;
    for (const item of fresh) {
      const r = await addQuestionAction({ code, text: item.text, referenceAnswer: item.ref });
      if (r.ok) added++;
      else failed++;
    }
    setBulkBusy(false);
    setBulk("");
    const dupNote = duplicates > 0 ? ` ${duplicates} duplicate(s) skipped.` : "";
    setNotice(
      failed === 0
        ? { kind: "ok", text: `Added ${added} question(s); they auto-slot into the first open played slots.${dupNote}` }
        : { kind: "err", text: `${added} added, ${failed} failed. Fix those lines and try again.${dupNote}` },
    );
    router.refresh();
  }

  function importFromMatch() {
    if (!sourceCode || importing) return;
    setImporting(true);
    setNotice(null);
    void importQuestionsAction({ code, sourceCode })
      .then((r) => {
        if (r.ok) {
          setNotice({
            kind: "ok",
            text: `Imported ${r.data.added} question(s) — ${r.data.slotsFilled} slotted${r.data.skipped > 0 ? `, ${r.data.skipped} skipped` : ""}.`,
          });
          setSourceCode("");
          router.refresh();
        } else {
          setNotice({ kind: "err", text: r.error });
        }
      })
      .finally(() => setImporting(false));
  }

  function loadFile(file: File) {
    void file.text().then((raw) => {
      const converted = raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => {
          const parts = splitQuestionLine(line);
          return parts ? `${parts[0].trim()} | ${parts[1].trim()}` : line;
        })
        .join("\n");
      setBulk((prev) => (prev ? `${prev}\n${converted}` : converted));
    });
  }

  return (
    <Card>
      <CardHeader
        title="The twenty"
        description={`Prepare up to 20 questions; the first ten are auto-placed into slots 1–10. (${selected}/10 placed) · ${inBank} prepared`}
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

      {sources.length > 0 ? (
        <div className="flex flex-wrap items-end gap-2 border-b border-line p-4">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-muted">
            Reuse questions from a past match
            <Select
              value={sourceCode}
              onChange={(e) => setSourceCode(e.target.value)}
              className="h-9 w-72 py-1 text-xs"
            >
              <option value="">Pick a match…</option>
              {sources.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </Select>
          </label>
          <Button size="sm" variant="secondary" disabled={!sourceCode} loading={importing} onClick={importFromMatch}>
            Import questions
          </Button>
          <p className="basis-full text-xs text-subtle">Copies into the bank and slots them 1–10 — duplicates are skipped.</p>
        </div>
      ) : null}

      <div className="border-b border-line p-4">
        <details>
          <summary className="cursor-pointer text-sm font-bold text-brand">⚡ Bulk import — paste many at once</summary>
          <p className="mt-2 text-xs text-muted">
            One question per line as <code className="rounded bg-surface px-1 py-0.5">Question | Answer</code>, a tab, or CSV
            (<code className="rounded bg-surface px-1 py-0.5">&quot;Question&quot;,&quot;Answer&quot;</code>). Duplicates are
            skipped; new ones auto-slot into the first open played slots (1–10).
          </p>
          <textarea
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            rows={7}
            spellCheck={false}
            placeholder={"What is the capital of Nigeria? | Abuja\nWhat is 2 + 2? | 4\nWho wrote Things Fall Apart? | Chinua Achebe"}
            className="mt-3 w-full rounded-lg border-2 border-line-strong bg-bg-elevated px-3 py-2 font-mono text-xs text-fg placeholder:text-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button variant="secondary" size="sm" disabled={!bulk.trim() || bulkBusy} loading={bulkBusy} onClick={() => void submitBulk()}>
              Import questions
            </Button>
            <label className="inline-flex h-9 cursor-pointer items-center rounded-lg border-2 border-line bg-surface px-3 text-xs font-semibold text-muted hover:border-brand/40 hover:text-fg">
              📄 Load from file (.txt/.csv)
              <input
                type="file"
                accept=".txt,.csv,text/plain,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) loadFile(file);
                  e.target.value = "";
                }}
              />
            </label>
            <span className="text-xs text-subtle">{inBank}/20 used</span>
          </div>
        </details>
      </div>

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

export type PreviousLineup = Partial<Record<TeamSide, { starterIds: string[]; captainId: string | null }>>;

export function LineupManager({
  code,
  homeName,
  awayName,
  teams,
  previous,
}: {
  code: string;
  homeName: string;
  awayName: string;
  teams: Record<TeamSide, LineupPlayer[]>;
  previous?: PreviousLineup | null;
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
        <TeamLineupEditor side="HOME" name={homeName} tone="teama" code={code} players={teams.HOME} flash={flash} previous={previous?.HOME} />
        <TeamLineupEditor side="AWAY" name={awayName} tone="teamb" code={code} players={teams.AWAY} flash={flash} previous={previous?.AWAY} />
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
  previous,
}: {
  side: TeamSide;
  name: string;
  tone: "teama" | "teamb";
  code: string;
  players: LineupPlayer[];
  flash: (r: { ok: boolean; error?: string }, t: string) => void;
  previous?: { starterIds: string[]; captainId: string | null };
}) {
  const sorted = [...players].sort((a, b) => a.number - b.number);
  const [selected, setSelected] = React.useState<string[]>(() => {
    const starters = sorted.filter((p) => p.role === "STARTER");
    return (starters.length > 5 ? starters.slice(0, 5) : starters).map((p) => p.userId);
  });
  const [captain, setCaptain] = React.useState<string>(() => players.find((p) => p.isCaptain)?.userId ?? "");
  const [busy, setBusy] = React.useState(false);
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

  function applySquadDefaults() {
    const firstFive = sorted.slice(0, 5).map((p) => p.userId);
    setSelected(firstFive);
    const squadCaptain = players.find((p) => p.isCaptain);
    setCaptain(squadCaptain && firstFive.includes(squadCaptain.userId) ? squadCaptain.userId : firstFive[0] ?? "");
  }

  function applyLastMeeting() {
    if (!previous) return;
    const rosterIds = new Set(players.map((p) => p.userId));
    const valid = previous.starterIds.filter((id) => rosterIds.has(id)).slice(0, 5);
    if (valid.length === 0) return;
    setSelected(valid);
    setCaptain(previous.captainId && valid.includes(previous.captainId) ? previous.captainId : valid[0]);
  }

  return (
    <Card className={cn("h-fit", "border")}>
      <CardHeader title={name} description={side === "HOME" ? "Team A · pick 5 starters and the captain" : "Team B · pick 5 starters and the captain"} aside={<Badge tone={tone as never}>{selected.length}/5</Badge>} />
      <div className="p-4">
        {players.length === 0 ? (
          <p className="text-sm text-subtle">No players assigned yet — the admin fills the roster.</p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-1.5">
              <Button size="sm" variant="ghost" onClick={applySquadDefaults} disabled={players.length < 5}>
                Squad default (first 5)
              </Button>
              {previous ? (
                <Button size="sm" variant="ghost" onClick={applyLastMeeting}>
                  ◀ Copy last meeting
                </Button>
              ) : null}
            </div>
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

/** One-click setup completion for admins/referees — visible while anything is missing. */
export function SetupAutoComplete({ code, missing }: { code: string; missing: string[] }) {
  const router = useRouter();
  const [notice, setNotice] = React.useState<Notice>(null);
  const [busy, setBusy] = React.useState(false);
  if (missing.length === 0) return null;

  return (
    <div className="mt-3 rounded-xl border-2 border-brand/30 bg-brand/5 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted">
          In a hurry? Auto-fill starters (first 5 by shirt), captains and empty question slots — then review before kick-off.
        </p>
        <Button
          variant="secondary"
          size="sm"
          className="ml-auto"
          loading={busy}
          onClick={() => {
            if (busy) return;
            setBusy(true);
            setNotice(null);
            void autoCompleteSetupAction(code)
              .then((r) => {
                if (r.ok) {
                  const bits = [
                    `${r.data.starters} starters · ${r.data.captains} captain(s)`,
                    `${r.data.slotsFilled} question slot(s) filled`,
                  ];
                  if (r.data.sidesSkipped.length > 0) bits.push(`skipped ${r.data.sidesSkipped.join(" & ")} (under 5 players)`);
                  setNotice({ kind: "ok", text: `Auto-filled ${bits.join(" · ")}.` });
                  router.refresh();
                } else {
                  setNotice({ kind: "err", text: r.error });
                }
              })
              .finally(() => setBusy(false));
          }}
        >
          ⚡ Auto-complete setup
        </Button>
      </div>
      {notice ? <div className="mt-2"><NoticeLine notice={notice} /></div> : null}
    </div>
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
