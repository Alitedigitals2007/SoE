"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  addCompetitionTeamAction,
  addTeamMemberAction,
  assignRefereeAction,
  createCompetitionAction,
  createTeamAction,
  generateCupRoundAction,
  generateGroupFixturesAction,
  generateLeagueFixturesAction,
  removeTeamMemberAction,
  setCompetitionStatusAction,
  setTeamCaptainAction,
  setTeamImageAction,
} from "@/app/actions/platform";
import { Button, Card, CardHeader, cn, Field, Input, Select } from "@/components/ui";

type Notice = { kind: "ok" | "err"; text: string } | null;

function NoticeLine({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <p
      role={notice.kind === "err" ? "alert" : "status"}
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        notice.kind === "err" ? "border-danger/40 bg-danger/10 text-danger" : "border-success/40 bg-success/10 text-success",
      )}
    >
      {notice.text}
    </p>
  );
}

function useFlash() {
  const [notice, setNotice] = React.useState<Notice>(null);
  const router = useRouter();
  function flash(r: { ok: boolean; error?: string }, okText: string, refresh = true) {
    if (r.ok) {
      setNotice({ kind: "ok", text: okText });
      if (refresh) router.refresh();
    } else setNotice({ kind: "err", text: r.error ?? "Action failed." });
  }
  return { notice, flash, router };
}

/* ------------------------------- create team ------------------------------- */

export function CreateTeamForm() {
  const { notice, flash, router } = useFlash();
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  return (
    <Card>
      <CardHeader title="Create a team" description="A club with up to 8 registered players." />
      <form
        className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          void createTeamAction({ name, code }).then((r) => {
            if (r.ok) {
              setName("");
              setCode("");
              router.refresh();
            }
            flash(r, "Team created.");
          });
        }}
      >
        <Field label="Team name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lagos United" required />
        </Field>
        <Field label="Code">
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="LAG" maxLength={3} required className="w-24" />
        </Field>
        <div className="flex items-end">
          <Button type="submit" disabled={!name.trim() || !code.trim()}>
            Create
          </Button>
        </div>
        {notice ? <div className="sm:col-span-3"><NoticeLine notice={notice} /></div> : null}
      </form>
    </Card>
  );
}

/* --------------------------- team members manager -------------------------- */

export type TeamMemberRow = { userId: string; name: string; number: number; isCaptain: boolean };
export type AvailablePlayer = { id: string; name: string };

export function TeamCrestEditor({ teamId, imageUrl }: { teamId: string; imageUrl: string | null }) {
  const { notice, flash } = useFlash();
  const [value, setValue] = React.useState(imageUrl ?? "");
  return (
    <Card className="max-w-xl">
      <CardHeader title="Crest / logo" description="A public image shown on the team card and team page." />
      <form
        className="flex flex-wrap items-end gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void setTeamImageAction({ teamId, imageUrl: value || null }).then((r) => flash(r, "Crest updated."));
        }}
      >
        <Field label="Image URL" className="min-w-64 flex-1">
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="https://…/crest.png" />
        </Field>
        <Button type="submit" disabled={value.trim() === (imageUrl ?? "")}>
          Save crest
        </Button>
        {imageUrl ? (
          <Button type="button" variant="ghost" onClick={() => { setValue(""); void setTeamImageAction({ teamId, imageUrl: null }).then((r) => flash(r, "Crest removed.")); }}>
            Remove
          </Button>
        ) : null}
        {notice ? <div className="basis-full"><NoticeLine notice={notice} /></div> : null}
        {imageUrl ? (
          <div className="basis-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Team crest preview" className="h-16 w-16 rounded-xl border border-fg/15 bg-white object-cover" />
          </div>
        ) : null}
      </form>
    </Card>
  );
}

export function TeamMembers({ teamId, members, available }: { teamId: string; members: TeamMemberRow[]; available: AvailablePlayer[] }) {
  const { notice, flash, router } = useFlash();
  const [playerId, setPlayerId] = React.useState("");
  const [number, setNumber] = React.useState(1);
  const taken = members.map((m) => m.number);

  return (
    <Card>
      <CardHeader title="Squad" description={`${members.length}/8 players`} aside={<Button size="sm" variant="secondary" onClick={() => router.push("/admin/teams")}>All teams</Button>} />
      <form
        className="flex flex-wrap items-end gap-3 border-b border-line p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!playerId) return;
          void addTeamMemberAction({ teamId, userId: playerId, number }).then((r) => {
            if (r.ok) {
              setPlayerId("");
              router.refresh();
            }
            flash(r, "Player added.");
          });
        }}
      >
        <Field label="Player">
          <Select value={playerId} onChange={(e) => setPlayerId(e.target.value)} className="w-56">
            <option value="">Choose…</option>
            {available.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Squad no.">
          <Select value={number} onChange={(e) => setNumber(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n} disabled={taken.includes(n)}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" disabled={!playerId}>
          Add
        </Button>
        {notice ? <div className="basis-full"><NoticeLine notice={notice} /></div> : null}
      </form>

      <ul className="divide-y divide-line/70">
        {members.length === 0 ? (
          <li className="px-4 py-6 text-sm text-subtle">No players yet — add up to eight.</li>
        ) : (
          [...members]
            .sort((a, b) => a.number - b.number)
            .map((m) => (
              <li key={m.userId} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="flex items-center gap-3">
                  <span className="w-5 text-right text-xs font-bold text-subtle">{m.number}</span>
                  <span className="font-medium text-fg">{m.name}</span>
                  {m.isCaptain ? (
                    <span className="rounded-full border border-gold/30 bg-gold/15 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-gold">Captain</span>
                  ) : null}
                </span>
                <span className="flex items-center gap-3">
                  {!m.isCaptain ? (
                    <button
                      type="button"
                      className="text-xs text-subtle underline-offset-2 hover:text-brand hover:underline"
                      onClick={() => void setTeamCaptainAction({ teamId, userId: m.userId }).then((r) => flash(r, "Captain set."))}
                    >
                      Make captain
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="text-xs text-subtle underline-offset-2 hover:text-subtle hover:line-through"
                      onClick={() => void setTeamCaptainAction({ teamId, userId: null }).then((r) => flash(r, "Captain cleared."))}
                    >
                      Remove captain
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-xs text-subtle underline-offset-2 hover:text-danger hover:underline"
                    onClick={() => void removeTeamMemberAction({ teamId, userId: m.userId }).then((r) => flash(r, "Player removed."))}
                  >
                    Remove
                  </button>
                </span>
              </li>
            ))
        )}
      </ul>
    </Card>
  );
}

/* ----------------------------- create competition --------------------------- */

export type TeamOption = { id: string; name: string; code: string };

export function CreateCompetitionForm({ teams }: { teams: TeamOption[] }) {
  const router = useRouter();
  const { notice, flash } = useFlash();
  const [name, setName] = React.useState("");
  const [season, setSeason] = React.useState(`${new Date().getFullYear()}/${String((new Date().getFullYear() + 1) % 100).padStart(2, "0")}`);
  const [type, setType] = React.useState<"LEAGUE" | "CUP">("LEAGUE");
  const [teamIds, setTeamIds] = React.useState<string[]>([]);

  function toggle(id: string) {
    setTeamIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader title="New competition" description="Pick teams, then you'll generate fixtures in the competition." />
      <form
        className="space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void createCompetitionAction({ name, type, season, teamIds }).then((r) => {
            if (r.ok && r.data?.slug) {
              router.push(`/admin/competitions/${r.data.slug}`);
            } else {
              flash({ ok: false, error: (r as { error?: string }).error ?? "Could not create competition." }, "");
            }
          });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Competition name" className="sm:col-span-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Elite Premier League" required />
          </Field>
          <Field label="Season">
            <Input value={season} onChange={(e) => setSeason(e.target.value)} placeholder="2026/27" required />
          </Field>
        </div>
        <Field label="Format">
          <div className="grid grid-cols-2 gap-2">
            <TypeOption active={type === "LEAGUE"} label="📊 League" hint="Round-robin + table" onClick={() => setType("LEAGUE")} />
            <TypeOption active={type === "CUP"} label="🏆 Knockout" hint="Bracket, single elim." onClick={() => setType("CUP")} />
          </div>
        </Field>
        <Field label={`Teams (${teamIds.length} selected${type === "CUP" ? " — needs an even count" : ""})`}>
          <div className="grid max-h-64 grid-cols-2 gap-1.5 overflow-y-auto sm:grid-cols-3">
            {teams.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.id)}
                aria-pressed={teamIds.includes(t.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  teamIds.includes(t.id) ? "border-brand bg-brand/10 text-brand-deep" : "border-line bg-bg-raised text-muted hover:border-line-strong",
                )}
              >
                <span aria-hidden>{teamIds.includes(t.id) ? "✓" : "+"}</span>
                <span className="truncate font-medium">{t.name}</span>
              </button>
            ))}
          </div>
        </Field>
        {notice ? <NoticeLine notice={notice} /> : null}
        <Button type="submit" disabled={teamIds.length < 2 || !name.trim() || !season.trim()}>
          Create {type === "CUP" ? "cup" : "league"}
        </Button>
      </form>
    </Card>
  );
}

function TypeOption({ active, label, hint, onClick }: { active: boolean; label: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-xl border px-4 py-3 text-left transition-colors",
        active ? "border-brand bg-brand/10" : "border-line bg-bg-raised hover:border-line-strong",
      )}
    >
      <p className={cn("font-bold", active ? "text-brand-deep" : "text-fg")}>{label}</p>
      <p className="text-xs text-subtle">{hint}</p>
    </button>
  );
}

/* --------------------------- competition actions ---------------------------- */

export function CompetitionActions({
  competitionId,
  status,
  type,
  hasFixtures,
  availableTeams,
  currentTeamIds,
  finishedLatestRound,
}: {
  competitionId: string;
  status: "DRAFT" | "ACTIVE" | "FINISHED";
  type: "LEAGUE" | "CUP" | "LEAGUE_CUP" | "CUSTOM";
  hasFixtures: boolean;
  availableTeams: TeamOption[];
  currentTeamIds: string[];
  finishedLatestRound: boolean;
}) {
  const { notice, flash, router } = useFlash();
  const [teamId, setTeamId] = React.useState("");
  const [roundLabel, setRoundLabel] = React.useState("");

  return (
    <Card>
      <CardHeader title="Competition control" description="Admin actions for this competition." />
      <div className="space-y-4 p-4">
        {notice ? <NoticeLine notice={notice} /> : null}

        {status !== "FINISHED" ? (
          <Button
            variant="danger"
            className="w-full"
            onClick={() => {
              if (confirm("Close this competition? It stays public but shows as Closed."))
                void setCompetitionStatusAction({ competitionId, status: "FINISHED" }).then((r) => {
                  flash(r, "Competition closed.");
                  router.refresh();
                });
            }}
          >
            Close competition
          </Button>
        ) : (
          <Button
            variant="secondary"
            className="w-full"
            onClick={() =>
              void setCompetitionStatusAction({ competitionId, status: "ACTIVE" }).then((r) => {
                flash(r, "Competition reopened.");
                router.refresh();
              })
            }
          >
            Reopen competition
          </Button>
        )}

        {!hasFixtures ? (
          <>
            <div className="flex flex-wrap items-end gap-2">
              {type === "LEAGUE" && (
                <Button variant="primary" onClick={() => void generateLeagueFixturesAction({ competitionId }).then((r) => { flash(r, "League fixtures generated."); router.refresh(); })}>
                  Generate round-robin fixtures
                </Button>
              )}
              {type === "CUP" && (
                <Button variant="primary" onClick={() => void generateCupRoundAction({ competitionId }).then((r) => { flash(r, "Cup round generated."); router.refresh(); })}>
                  Generate round 1
                </Button>
              )}
              {type === "LEAGUE_CUP" && (
                <Button variant="primary" onClick={() => void generateGroupFixturesAction({ competitionId }).then((r) => { flash(r, "Group fixtures generated."); router.refresh(); })}>
                  Generate group fixtures
                </Button>
              )}
              {type === "CUSTOM" && (
                <span className="text-xs text-muted italic">Custom competitions have no auto-generation. Add matches manually.</span>
              )}
            </div>
            <div className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
              <Select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="w-56" aria-label="Add team">
                <option value="">Add a team…</option>
                {availableTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
              <Button
                variant="secondary"
                disabled={!teamId}
                onClick={() =>
                  void addCompetitionTeamAction({ competitionId, teamId }).then((r) => {
                    if (r.ok) setTeamId("");
                    flash(r, "Team added.");
                  })
                }
              >
                Add team
              </Button>
              <span className="text-xs text-subtle">{currentTeamIds.length} teams in competition</span>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">Fixtures exist. Manage referees below, then run each match.</p>
            {(type === "CUP" || type === "LEAGUE_CUP") ? (
              <div className="flex flex-wrap items-end gap-2">
                <Input value={roundLabel} onChange={(e) => setRoundLabel(e.target.value)} placeholder="Round name (cosmetic)" className="max-w-52" hidden aria-hidden />
                <Button
                  variant="secondary"
                  disabled={!finishedLatestRound}
                  title={finishedLatestRound ? "" : "Finish every match in the current round first"}
                  onClick={() => void generateCupRoundAction({ competitionId }).then((r) => { flash(r, "Next cup round generated."); router.refresh(); })}
                >
                  Generate next knockout round
                </Button>
                {!finishedLatestRound ? (
                  <span className="text-xs text-warning">All matches in the current round must be finished first.</span>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </Card>
  );
}

/* -------------------------- referee assignment row -------------------------- */

export function FixtureRefereeRow({
  match,
  referees,
}: {
  match: { id: string; code: string; homeName: string; awayName: string; homeScore: number; awayScore: number; status: string; cupRound: number | null; refereeId: string | null };
  referees: { id: string; name: string }[];
}) {
  const { flash } = useFlash();
  const [value, setValue] = React.useState(match.refereeId ?? "");
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-fg">
          {match.homeName} <span className="text-subtle">{match.status === "FINISHED" ? `${match.homeScore}–${match.awayScore}` : "v"}</span> {match.awayName}
        </p>
        <p className="text-xs text-subtle">
          Code {match.code}
          {match.cupRound ? ` · Cup round ${match.cupRound}` : ""} · <span className={cn("font-semibold", match.status === "LIVE" ? "text-success" : match.status === "DRAFT" ? "text-warning" : "text-muted")}>{match.status}</span>
        </p>
      </div>
      {match.status !== "FINISHED" ? (
        <label className="flex items-center gap-1.5 text-xs font-semibold text-muted">
          Referee
          <Select
            className="w-44 py-1 text-xs"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => {
              if (value !== (match.refereeId ?? "")) void assignRefereeAction({ matchId: match.id, refereeId: value || null }).then((r) => flash(r, "Referee updated."));
            }}
          >
            <option value="">Unassigned</option>
            {referees.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </label>
      ) : null}
      <a href={`/match/${match.code}`} className="rounded-lg bg-surface px-3 py-1.5 text-xs font-semibold text-fg hover:bg-line">
        Open
      </a>
    </div>
  );
}
