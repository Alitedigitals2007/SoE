"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { addPlayerAction, createMatchAction, postponeMatchAction, removePlayerAction, setMatchScheduleAction } from "@/app/actions/match";
import { createUserAction, updateUserAction } from "@/app/actions/admin";
import { Badge, Button, Card, CardHeader, cn, Field, Input, Select } from "@/components/ui";
import type { Role, TeamSide } from "@/lib/domain";

type Notice = { kind: "ok" | "err"; text: string } | null;

/* ------------------------------ user management ---------------------------- */

export type UserRow = { id: string; name: string; email: string; role: Role; createdAt: string };

export function UsersManager({ users }: { users: UserRow[] }) {
  const [notice, setNotice] = React.useState<Notice>(null);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState<Role>("PLAYER");
  const [busy, setBusy] = React.useState(false);
  const router = useRouter();

  function flash(r: { ok: boolean; error?: string }, okText: string) {
    if (r.ok) {
      setNotice({ kind: "ok", text: okText });
      router.refresh();
    } else {
      setNotice({ kind: "err", text: r.error ?? "Action failed." });
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="h-fit">
        <CardHeader title="New account" description="Create a referee or player login." />
        <form
          className="space-y-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            void createUserAction({ name, email, password, role }).then((r) => {
              if (r.ok) {
                setName("");
                setEmail("");
                setPassword("");
              }
              flash(r, "Account created.");
            }).finally(() => setBusy(false));
          }}
        >
          <Field label="Full name" htmlFor="uname">
            <Input id="uname" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. David Adeyemi" />
          </Field>
          <Field label="Email" htmlFor="uemail">
            <Input id="uemail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="player@example.com" />
          </Field>
          <Field label="Password" htmlFor="upw">
            <Input id="upw" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" />
          </Field>
          <Field label="Role" htmlFor="urole">
            <Select id="urole" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="REFEREE">Referee</option>
              <option value="PLAYER">Player</option>
              <option value="USER">Fan / User</option>
            </Select>
          </Field>
          {notice ? <NoticeLine notice={notice} /> : null}
          <Button type="submit" className="w-full" loading={busy}>
            Create account
          </Button>
        </form>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader title={`Accounts (${users.length})`} description="Referees run matches; players join rosters." />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-subtle">
              <tr>
                <th className="px-4 py-2 font-semibold">Name</th>
                <th className="px-4 py-2 font-semibold">Email</th>
                <th className="px-4 py-2 font-semibold">Role</th>
                <th className="px-4 py-2 font-semibold">Reset password</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {users.map((u) => (
                <UserRowItem key={u.id} user={u} flash={flash} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function UserRowItem({ user, flash }: { user: UserRow; flash: (r: { ok: boolean; error?: string }, t: string) => void }) {
  const [password, setPassword] = React.useState("");
  return (
    <tr className="hover:bg-surface/50">
      <td className="px-4 py-2.5 font-medium text-fg">{user.name}</td>
      <td className="px-4 py-2.5 text-muted">{user.email}</td>
      <td className="px-4 py-2.5">
        <Select
          aria-label={`Role of ${user.name}`}
          className="h-8 w-28 py-1 text-xs"
          value={user.role}
          onChange={(e) =>
            void updateUserAction({ userId: user.id, role: e.target.value as Role }).then((r) => flash(r, "Role updated."))
          }
          >
            <option value="REFEREE">Referee</option>
            <option value="PLAYER">Player</option>
            <option value="USER">Fan / User</option>
        </Select>
      </td>
      <td className="px-4 py-2.5">
        <form
          className="flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!password) return;
            void updateUserAction({ userId: user.id, password }).then((r) => {
              if (r.ok) setPassword("");
              flash(r, "Password updated.");
            });
          }}
        >
          <Input aria-label="New password" type="password" placeholder="New password" className="h-8 max-w-36 py-1 text-xs" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button size="sm" type="submit" variant="secondary" disabled={password.length < 8}>
            Set
          </Button>
        </form>
      </td>
    </tr>
  );
}

/* ------------------------------ new match form ----------------------------- */

export type RefereeOption = { id: string; name: string; email: string };
export type TeamOptionRow = { id: string; name: string; _count: { members: number } };

/** Wall-clock time chosen in Nigeria (Africa/Lagos, UTC+1, no DST) → UTC ISO. */
function nigeriaLocalToUtcIso(local: string): string | null {
  if (!local) return null;
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const utc = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h) - 1, Number(mi)));
  if (Number.isNaN(utc.getTime())) return null;
  return utc.toISOString();
}

export function CreateMatchForm({ referees, teams }: { referees: RefereeOption[]; teams: TeamOptionRow[] }) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"teams" | "custom">("teams");
  const [homeTeamId, setHomeTeamId] = React.useState("");
  const [awayTeamId, setAwayTeamId] = React.useState("");
  const [homeName, setHomeName] = React.useState("");
  const [awayName, setAwayName] = React.useState("");
  const [refereeId, setRefereeId] = React.useState("");
  const [countdownSeconds, setCountdownSeconds] = React.useState(15);
  const [kickoff, setKickoff] = React.useState("");
  const [notice, setNotice] = React.useState<Notice>(null);
  const [busy, setBusy] = React.useState(false);

  const teamsWithPlayers = teams.filter((t) => t._count.members > 0);

  return (
    <Card className="max-w-2xl">
      <CardHeader
        title="Set up a friendly"
        description="Choose two clubs (players auto-load) or type custom team names, pick the referee and schedule kick-off in Nigerian time."
      />
      <form
        className="space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (busy) return;
          if (mode === "teams" && (!homeTeamId || !awayTeamId)) return;
          setBusy(true);
          setNotice(null);
          const scheduledAt = kickoff ? nigeriaLocalToUtcIso(kickoff) : null;
          const payload =
            mode === "teams"
              ? { homeTeamId, awayTeamId, refereeId, countdownSeconds, scheduledAt }
              : { homeName, awayName, refereeId, countdownSeconds, scheduledAt };
          void createMatchAction(payload).then((r) => {
            if (r.ok) {
              router.replace(`/admin/matches/${r.data.code}/setup`);
            } else {
              setNotice({ kind: "err", text: r.error ?? "Could not create the match." });
              setBusy(false);
            }
          });
        }}
      >
        <div className="flex flex-wrap gap-2">
          <ModePill active={mode === "teams"} onClick={() => setMode("teams")} label="🏟️ From existing teams" />
          <ModePill active={mode === "custom"} onClick={() => setMode("custom")} label="✏️ Custom team names" />
        </div>

        {mode === "teams" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Home team" htmlFor="homeTeam">
              <Select
                id="homeTeam"
                value={homeTeamId}
                onChange={(e) => {
                  setHomeTeamId(e.target.value);
                  if (e.target.value === awayTeamId) setAwayTeamId("");
                }}
              >
                <option value="">Choose home team…</option>
                {teamsWithPlayers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t._count.members} players)
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Away team" htmlFor="awayTeam">
              <Select
                id="awayTeam"
                value={awayTeamId}
                onChange={(e) => {
                  setAwayTeamId(e.target.value);
                  if (e.target.value === homeTeamId) setHomeTeamId("");
                }}
              >
                <option value="">Choose away team…</option>
                {teamsWithPlayers
                  .filter((t) => t.id !== homeTeamId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t._count.members} players)
                    </option>
                  ))}
              </Select>
            </Field>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Team A name" htmlFor="home">
              <Input id="home" required value={homeName} onChange={(e) => setHomeName(e.target.value)} placeholder="e.g. Lagos United" />
            </Field>
            <Field label="Team B name" htmlFor="away">
              <Input id="away" required value={awayName} onChange={(e) => setAwayName(e.target.value)} placeholder="e.g. Abuja Stars" />
            </Field>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Referee" htmlFor="ref">
            <Select id="ref" value={refereeId} onChange={(e) => setRefereeId(e.target.value)}>
              <option value="">Choose referee…</option>
              {referees.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Seconds per question" htmlFor="cd">
            <Select id="cd" value={countdownSeconds} onChange={(e) => setCountdownSeconds(Number(e.target.value))}>
              <option value={10}>10 seconds</option>
              <option value={15}>15 seconds</option>
              <option value={20}>20 seconds</option>
              <option value={30}>30 seconds</option>
            </Select>
          </Field>
          <Field label="Kick-off (Nigeria time)" htmlFor="kickoff" hint="Optional — leave blank to start whenever you're ready.">
            <Input id="kickoff" type="datetime-local" value={kickoff} onChange={(e) => setKickoff(e.target.value)} />
          </Field>
        </div>

        {notice ? <NoticeLine notice={notice} /> : null}
        <Button type="submit" className="w-full" loading={busy} disabled={referees.length === 0}>
          {referees.length === 0
            ? "Create a referee account first"
            : mode === "teams" && teamsWithPlayers.length < 2
              ? "Add players to at least two teams first"
              : "Create & open match setup"}
        </Button>
      </form>
    </Card>
  );
}

export function PostponeEditor({ code, scheduledAt }: { code: string; scheduledAt: string | null }) {
  const [when, setWhen] = React.useState(scheduledAt ? utcIsoToNigeriaLocal(scheduledAt) : "");
  const [reason, setReason] = React.useState("");
  const [notice, setNotice] = React.useState<Notice>(null);
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  return (
    <Card className="max-w-xl">
      <CardHeader title="Postpone this match" description="Move the kick-off and tell everyone why (Nigeria time)." />
      <div className="flex flex-wrap items-end gap-3 p-4">
        <Field label="New kick-off (Nigeria time)" hint="Required to postpone.">
          <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </Field>
        <Field label="Reason (optional)">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Heavy rain" className="min-w-48" />
        </Field>
        <Button
          disabled={!when || busy}
          loading={busy}
          variant="secondary"
          onClick={() => {
            if (!when) return;
            setBusy(true);
            setNotice(null);
            void postponeMatchAction({ code, scheduledAt: nigeriaLocalToUtcIso(when), reason: reason || undefined }).then((r) => {
              setBusy(false);
              if (r.ok) {
                setNotice({ kind: "ok", text: "Match postponed." });
                router.refresh();
              } else {
                setNotice({ kind: "err", text: r.error ?? "Could not postpone." });
              }
            });
          }}
        >
          Postpone match
        </Button>
        {notice ? <div className="basis-full"><NoticeLine notice={notice} /></div> : null}
      </div>
    </Card>
  );
}

function ModePill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "rounded-lg border-2 border-brand bg-brand/10 px-3 py-1.5 text-sm font-semibold text-brand-deep"
          : "rounded-lg border-2 border-line bg-surface px-3 py-1.5 text-sm font-semibold text-muted hover:text-fg"
      }
    >
      {label}
    </button>
  );
}

function utcIsoToNigeriaLocal(iso: string): string {
  const shifted = new Date(new Date(iso).getTime() + 3600_000); // UTC+1 (Africa/Lagos)
  return shifted.toISOString().slice(0, 16);
}

export function ScheduleEditor({ code, scheduledAt }: { code: string; scheduledAt: string | null }) {
  const [value, setValue] = React.useState(scheduledAt ? utcIsoToNigeriaLocal(scheduledAt) : "");
  const [notice, setNotice] = React.useState<Notice>(null);
  const router = useRouter();
  const busy = false;

  function save(next: string) {
    const payload = next ? nigeriaLocalToUtcIso(next) : null;
    void setMatchScheduleAction({ code, scheduledAt: payload }).then((r) => {
      if (r.ok) {
        setNotice({ kind: "ok", text: next ? "Kick-off scheduled." : "Schedule cleared." });
        router.refresh();
      } else {
        setNotice({ kind: "err", text: r.error ?? "Could not save the schedule." });
      }
    });
  }

  return (
    <Card className="max-w-xl">
      <CardHeader title="Kick-off schedule" description="Times are Nigeria time (Africa/Lagos)." />
      <div className="flex flex-wrap items-end gap-3 p-4">
        <Field label="Kick-off date & time" hint={busy ? "Saving…" : "Leave blank for 'start whenever ready'."}>
          <Input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
        <Button variant="secondary" onClick={() => save(value)}>
          Save schedule
        </Button>
        {value ? (
          <Button variant="ghost" onClick={() => { setValue(""); save(""); }}>
            Clear
          </Button>
        ) : null}
        {notice ? <div className="basis-full"><NoticeLine notice={notice} /></div> : null}
      </div>
    </Card>
  );
}

/* ------------------------------- roster editor ------------------------------ */

export type RosterPlayer = { userId: string; name: string; team: TeamSide; number: number; role: "STARTER" | "SUB" | "OUT" };
export type AvailablePlayer = { id: string; name: string; email: string };

export function RosterManager({
  code,
  status,
  homeName,
  awayName,
  roster,
  available,
}: {
  code: string;
  status: string;
  homeName: string;
  awayName: string;
  roster: RosterPlayer[];
  available: AvailablePlayer[];
}) {
  const router = useRouter();
  const [notice, setNotice] = React.useState<Notice>(null);
  const [team, setTeam] = React.useState<TeamSide>("HOME");
  const [playerId, setPlayerId] = React.useState("");
  const [number, setNumber] = React.useState(1);
  const locked = status !== "DRAFT";

  function flash(r: { ok: boolean; error?: string }, t: string) {
    if (r.ok) {
      setNotice({ kind: "ok", text: t });
      router.refresh();
    } else {
      setNotice({ kind: "err", text: r.error ?? "Action failed." });
    }
  }

  const taken = (t: TeamSide) => roster.filter((p) => p.team === t).map((p) => p.number);
  const used = (t: TeamSide, n: number) => taken(t).includes(n);

  return (
    <div className="space-y-4">
      {notice ? <NoticeLine notice={notice} /> : null}
      <Card>
        <CardHeader
          title="Add a player"
          description="Each team holds 8 shirt numbers; assign up to 8 players per side."
          aside={locked ? <Badge tone="neutral">Locked after kick-off</Badge> : undefined}
        />
        {locked ? (
          <p className="p-4 text-sm text-muted">The roster is locked while this match is live or finished.</p>
        ) : (
          <form
            className="grid gap-3 p-4 sm:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!playerId) return;
              void addPlayerAction({ code, userId: playerId, team, number }).then((r) => {
                if (r.ok) setPlayerId("");
                flash(r, "Player added.");
              });
            }}
          >
            <Field label="Team">
              <Select value={team} onChange={(e) => setTeam(e.target.value as TeamSide)}>
                <option value="HOME">{homeName}</option>
                <option value="AWAY">{awayName}</option>
              </Select>
            </Field>
            <Field label="Player">
              <Select value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
                <option value="">Choose…</option>
                {available.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Shirt no.">
              <Select value={number} onChange={(e) => setNumber(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n} disabled={used(team, n)}>
                    {n}{used(team, n) ? " (taken)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end">
              <Button type="submit" disabled={!playerId} className="w-full">
                Add
              </Button>
            </div>
          </form>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <RosterColumn name={homeName} side="HOME" tone="teama" players={roster.filter((p) => p.team === "HOME")} locked={locked} onRemove={(uid) => void removePlayerAction({ code, userId: uid }).then((r) => flash(r, "Player removed."))} />
        <RosterColumn name={awayName} side="AWAY" tone="teamb" players={roster.filter((p) => p.team === "AWAY")} locked={locked} onRemove={(uid) => void removePlayerAction({ code, userId: uid }).then((r) => flash(r, "Player removed."))} />
      </div>
    </div>
  );
}

function RosterColumn({
  name,
  side,
  tone,
  players,
  locked,
  onRemove,
}: {
  name: string;
  side: TeamSide;
  tone: "teama" | "teamb";
  players: RosterPlayer[];
  locked: boolean;
  onRemove: (userId: string) => void;
}) {
  const sorted = [...players].sort((a, b) => a.number - b.number);
  const toneClass = tone === "teama" ? "text-teama" : "text-teamb";
  return (
    <Card>
      <CardHeader title={name} description={side === "HOME" ? "Team A" : "Team B"} aside={<Badge tone={tone as never}>{players.length}/8</Badge>} />
      <ul className="divide-y divide-line/70">
        {sorted.length === 0 ? (
          <li className="px-4 py-6 text-sm text-subtle">No players assigned yet.</li>
        ) : (
          sorted.map((p) => (
            <li key={p.userId} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-5 text-right text-xs font-bold tabular-nums text-subtle">{p.number}</span>
                <span className={cn("truncate font-medium text-fg")}>{p.name}</span>
                <Badge tone="neutral">{p.role === "STARTER" ? "Starter" : p.role === "SUB" ? "Bench" : "Out"}</Badge>
              </span>
              {!locked ? (
                <button type="button" onClick={() => onRemove(p.userId)} className="text-xs text-subtle underline-offset-2 hover:text-danger hover:underline">
                  Remove
                </button>
              ) : null}
            </li>
          ))
        )}
      </ul>
      {side === "HOME" && <p className={cn("px-4 pb-2 text-[10px] font-bold uppercase tracking-widest", toneClass)}>Shirt 1–8 · 5 starters by referee</p>}
      {side === "AWAY" && <p className={cn("px-4 pb-2 text-[10px] font-bold uppercase tracking-widest", toneClass)}>Shirt 1–8 · 5 starters by referee</p>}
    </Card>
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
