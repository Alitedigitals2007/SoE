"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fileComplaintAction, type ComplaintType } from "@/app/actions/complaints";
import { removeAvatarAction, uploadAvatarAction } from "@/app/actions/profile";
import { Avatar } from "@/components/Avatar";
import { Badge, Button, Field, Input, Select, Textarea, cn } from "@/components/ui";
import type { PlayerStats } from "@/lib/stats/player";

export type PlayerFixture = {
  id: string;
  code: string;
  homeName: string;
  awayName: string;
  status: "DRAFT" | "LIVE" | "FINISHED";
  scheduledAt: string | null;
  kickoffText: string | null;
  homeScore: number;
  awayScore: number;
  team: "HOME" | "AWAY";
  number: number;
  role: "STARTER" | "SUB" | "OUT";
  isCaptain: boolean;
  competition: { name: string; type: string } | null;
  cupRound: number | null;
};

export type PlayerComplaint = {
  id: string;
  type: string;
  subject: string;
  message: string;
  status: "OPEN" | "RESOLVED" | "DISMISSED";
  adminNote: string | null;
  fixture: string | null;
  createdAt: string;
};

const TABS = [
  { key: "overview", label: "Overview", icon: "🧭" },
  { key: "fixtures", label: "Fixtures", icon: "🗓️" },
  { key: "goals", label: "Goals & assists", icon: "⚽" },
  { key: "complaints", label: "Complaints", icon: "📮" },
  { key: "profile", label: "Profile", icon: "🖼️" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const COMPLAINT_TYPES: { value: ComplaintType; label: string; hint: string }[] = [
  { value: "MATCH_DECISION", label: "Referee decision", hint: "A call in a match you disagree with" },
  { value: "PLAYER_CONDUCT", label: "Player conduct", hint: "Another player's behaviour" },
  { value: "TECHNICAL", label: "Technical issue", hint: "Something in the app not working" },
  { value: "OTHER", label: "Something else", hint: "Anything not covered above" },
];

const STATUS_TONE = { OPEN: "warning", RESOLVED: "success", DISMISSED: "neutral" } as const;

export function PlayerHub({
  name,
  imageUrl,
  fixtures,
  stats,
  complaints,
}: {
  name: string;
  imageUrl: string | null;
  fixtures: PlayerFixture[];
  stats: PlayerStats;
  complaints: PlayerComplaint[];
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<TabKey>("overview");
  const [avatar, setAvatar] = React.useState(imageUrl);

  const scheduled = fixtures.filter((f) => f.status === "DRAFT" && f.scheduledAt);
  const nextFixture = scheduled[0] ?? fixtures.find((f) => f.status === "LIVE") ?? null;

  return (
    <div className="mt-6">
      {/* ------------------------------ tab strip ------------------------------ */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line pb-3" role="tablist" aria-label="Player dashboard">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === tab}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-lg border-2 px-3 py-1.5 text-sm font-semibold transition-colors",
              t.key === tab
                ? "border-brand bg-brand/10 text-brand-deep"
                : "border-line bg-surface text-muted hover:border-brand/40 hover:text-fg",
            )}
          >
            <span aria-hidden className="mr-1">{t.icon}</span>
            {t.label}
            {t.key === "fixtures" ? (
              <span className="ml-1.5 rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-black text-subtle">{fixtures.length}</span>
            ) : null}
            {t.key === "complaints" && complaints.length > 0 ? (
              <span className="ml-1.5 rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-black text-subtle">{complaints.length}</span>
            ) : null}
          </button>
        ))}
        <span className="ml-auto inline-flex items-center gap-2 text-sm font-bold text-fg">
          <Avatar name={name} src={avatar} size={32} />
          {name}
        </span>
      </div>

      {tab === "overview" ? <Overview fixtures={fixtures} stats={stats} next={nextFixture} onGoFixtures={() => setTab("fixtures")} /> : null}
      {tab === "fixtures" ? <FixtureList fixtures={fixtures} /> : null}
      {tab === "goals" ? <GoalsPanel stats={stats} /> : null}
      {tab === "complaints" ? <ComplaintsPanel fixtures={fixtures} complaints={complaints} /> : null}
      {tab === "profile" ? <ProfilePanel name={name} avatar={avatar} onAvatar={(url) => { setAvatar(url); router.refresh(); }} /> : null}
    </div>
  );
}

/* -------------------------------- overview -------------------------------- */

function Overview({
  fixtures,
  stats,
  next,
  onGoFixtures,
}: {
  fixtures: PlayerFixture[];
  stats: PlayerStats;
  next: PlayerFixture | null;
  onGoFixtures: () => void;
}) {
  const live = fixtures.filter((f) => f.status === "LIVE");
  const finished = fixtures.filter((f) => f.status === "FINISHED");
  return (
    <div className="mt-5 space-y-5">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {[
          { label: "Goals", value: stats.goals, tone: "text-brand" },
          { label: "Assists", value: stats.assists, tone: "text-gold-strong" },
          { label: "MOTM", value: stats.motm, tone: "text-gold-strong" },
          { label: "Games", value: stats.matches, tone: "text-fg" },
          { label: "Yellows", value: stats.yellowCards, tone: "text-warning" },
          { label: "Reds", value: stats.redCards, tone: "text-danger" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border-2 border-fg/10 bg-bg-elevated p-3 text-center shadow-[3px_3px_0_rgba(11,32,48,.06)]">
            <p className={cn("text-2xl font-black tabular-nums", s.tone)}>{s.value}</p>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-2xl border-2 border-fg/15 bg-bg-elevated p-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-gold-strong">Next up</h3>
          {next ? (
            <Link href={`/match/${next.code}`} className="mt-2 block rounded-xl border border-line bg-white p-3 transition-colors hover:border-brand/50">
              <p className="text-sm font-bold text-fg">{next.homeName} v {next.awayName}</p>
              <p className="mt-0.5 text-xs text-muted">
                {next.kickoffText ?? next.status}
                {next.competition ? ` · ${next.competition.type === "CUP" ? "🏆" : "📊"} ${next.competition.name}` : ""}
              </p>
            </Link>
          ) : (
            <p className="mt-2 text-sm text-muted">No upcoming or live fixture right now.</p>
          )}
          <p className="mt-2 text-xs text-muted">
            {live.length > 0 ? "🔴 A match of yours is live right now!" : `${finished.length} finished match${finished.length === 1 ? "" : "es"} on record.`}
          </p>
          <Button variant="ghost" className="mt-3 w-full" onClick={onGoFixtures}>
            See all fixtures
          </Button>
        </section>

        <section className="rounded-2xl border-2 border-fg/15 bg-bg-elevated p-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-gold-strong">Contribution</h3>
          <div className="mt-3 space-y-3">
            <ContributionMini label="Goals" value={stats.goals} share={stats.goalShare} total={stats.teamGoals} tone="bg-brand" />
            <ContributionMini label="Assists" value={stats.assists} share={stats.assistShare} total={stats.teamAssists} tone="bg-gold-strong" />
          </div>
          <p className="mt-3 text-[11px] text-subtle">Your share of everything your sides produced.</p>
        </section>
      </div>
    </div>
  );
}

function ContributionMini({
  label,
  value,
  share,
  total,
  tone,
}: {
  label: string;
  value: number;
  share: number | null;
  total: number;
  tone: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-bold text-fg">
          {label} <span className="tabular-nums text-brand">{value}</span>
        </p>
        <p className="text-xs font-semibold text-muted">{share !== null ? `${share}%` : "—"}</p>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(100, share ?? 0)}%` }} />
      </div>
      <p className="mt-0.5 text-[10px] text-subtle">of {total} by your sides</p>
    </div>
  );
}

/* -------------------------------- fixtures -------------------------------- */

const FILTERS = [
  { key: "all", label: "All" },
  { key: "scheduled", label: "Scheduled" },
  { key: "draft", label: "Draft" },
  { key: "live", label: "Live" },
  { key: "finished", label: "Finished" },
] as const;

function FixtureList({ fixtures }: { fixtures: PlayerFixture[] }) {
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]["key"]>("all");
  const shown = fixtures.filter((f) => {
    if (filter === "all") return true;
    if (filter === "scheduled") return f.status === "DRAFT" && f.scheduledAt;
    if (filter === "draft") return f.status === "DRAFT" && !f.scheduledAt;
    if (filter === "live") return f.status === "LIVE";
    return f.status === "FINISHED";
  });

  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors",
              filter === f.key ? "border-brand bg-brand/10 text-brand-deep" : "border-line bg-surface text-muted hover:text-fg",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="mt-4 rounded-2xl border-2 border-dashed border-fg/20 bg-bg-elevated p-8 text-center text-sm text-muted">
          No fixtures in this view.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {shown.map((f) => (
            <li key={f.id}>
              <Link
                href={`/match/${f.code}`}
                className="block rounded-xl border-2 border-fg/15 bg-bg-elevated px-4 py-3 transition-all hover:-translate-y-0.5 hover:border-brand/40"
              >
                {f.competition ? (
                  <p className="text-[10px] font-black uppercase tracking-wider text-gold-strong">
                    <span aria-hidden>{f.competition.type === "CUP" ? "🏆" : "📊"}</span> {f.competition.name}
                    {f.competition.type === "CUP" && f.cupRound ? ` · Round ${f.cupRound}` : ""}
                  </p>
                ) : (
                  <p className="text-[10px] font-black uppercase tracking-wider text-subtle">Friendly</p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold text-fg">
                    {f.homeName} <span className="text-subtle">v</span> {f.awayName}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {f.status === "LIVE" ? <Badge tone="danger">● Live</Badge> : null}
                    {f.status === "FINISHED" ? (
                      <Badge tone="success">FT {f.homeScore}–{f.awayScore}</Badge>
                    ) : null}
                    {f.status === "DRAFT" ? <Badge tone={f.scheduledAt ? "warning" : "neutral"}>{f.scheduledAt ? "Scheduled" : "Draft"}</Badge> : null}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                  {f.kickoffText ? <span>🗓️ {f.kickoffText}</span> : null}
                  <span>You: #{f.number} for {f.team === "HOME" ? f.homeName : f.awayName}</span>
                  <Badge tone={f.role === "STARTER" ? "pitch" : f.role === "SUB" ? "warning" : "danger"} className="!text-[9px]">
                    {f.role === "STARTER" ? "Starter" : f.role === "SUB" ? "Bench" : "Sent off"}
                  </Badge>
                  {f.isCaptain ? <Badge tone="gold" className="!text-[9px]">Captain</Badge> : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ----------------------------- goals & assists ---------------------------- */

function GoalsPanel({ stats }: { stats: PlayerStats }) {
  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <section className="rounded-2xl border-2 border-fg/15 bg-bg-elevated p-5">
        <h3 className="text-xs font-black uppercase tracking-widest text-gold-strong">Goals</h3>
        <p className="mt-1 text-4xl font-black tabular-nums text-brand">{stats.goals}</p>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface">
          <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, stats.goalShare ?? 0)}%` }} />
        </div>
        <p className="mt-1 text-xs text-muted">
          {stats.goalShare !== null ? `${stats.goalShare}% of your sides' ${stats.teamGoals} goals` : `Your sides scored ${stats.teamGoals} goals`}
        </p>
      </section>
      <section className="rounded-2xl border-2 border-fg/15 bg-bg-elevated p-5">
        <h3 className="text-xs font-black uppercase tracking-widest text-gold-strong">Assists</h3>
        <p className="mt-1 text-4xl font-black tabular-nums text-gold-strong">{stats.assists}</p>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface">
          <div className="h-full rounded-full bg-gold-strong" style={{ width: `${Math.min(100, stats.assistShare ?? 0)}%` }} />
        </div>
        <p className="mt-1 text-xs text-muted">
          {stats.assistShare !== null ? `${stats.assistShare}% of your sides' ${stats.teamAssists} assists` : `Your sides recorded ${stats.teamAssists} assists`}
        </p>
      </section>
      <section className="rounded-2xl border-2 border-fg/15 bg-bg-elevated p-5 sm:col-span-2">
        <h3 className="text-xs font-black uppercase tracking-widest text-gold-strong">Conduct record</h3>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Warnings", value: stats.warnings, tone: "text-muted" },
            { label: "Yellow cards", value: stats.yellowCards, tone: "text-warning" },
            { label: "Red cards", value: stats.redCards, tone: "text-danger" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-line bg-white p-3">
              <p className={cn("text-2xl font-black tabular-nums", s.tone)}>{s.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{s.label}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-subtle">
          A breach flag blocks goals — any pick from a flagged player becomes a foul instead.
        </p>
      </section>
    </div>
  );
}

/* ------------------------------- complaints ------------------------------- */

function ComplaintsPanel({ fixtures, complaints }: { fixtures: PlayerFixture[]; complaints: PlayerComplaint[] }) {
  const router = useRouter();
  const [type, setType] = React.useState<ComplaintType>("MATCH_DECISION");
  const [matchId, setMatchId] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<{ ok: boolean; msg: string } | null>(null);

  async function file() {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const r = await fileComplaintAction({ type, matchId: matchId || null, subject, message });
    setBusy(false);
    if (r.ok) {
      setSubject("");
      setMessage("");
      setMatchId("");
      setNotice({ ok: true, msg: "Complaint filed — an admin will review it." });
      router.refresh();
    } else {
      setNotice({ ok: false, msg: r.error });
    }
  }

  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
      <section className="rounded-2xl border-2 border-fg/15 bg-bg-elevated p-5">
        <h3 className="text-sm font-black uppercase tracking-wider text-fg">File a complaint</h3>
        <p className="mt-1 text-xs text-muted">Tell the admins exactly what happened — they review every one.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="What is it about?">
            <Select value={type} onChange={(e) => setType(e.target.value as ComplaintType)}>
              {COMPLAINT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Fixture (optional)">
            <Select value={matchId} onChange={(e) => setMatchId(e.target.value)}>
              <option value="">No specific fixture</option>
              {fixtures.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.homeName} v {f.awayName} — {f.status === "FINISHED" ? `FT ${f.homeScore}–${f.awayScore}` : f.status === "LIVE" ? "Live" : f.kickoffText ?? "Draft"}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <p className="mt-1 text-[11px] text-subtle">{COMPLAINT_TYPES.find((t) => t.value === type)?.hint}</p>

        <Field label="Subject" className="mt-3">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} placeholder="Short summary, e.g. 'Wrong goal given in Q4'" />
        </Field>
        <Field label="What happened?" className="mt-3">
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} rows={5} placeholder="Describe it — include the match, the question number, players involved…" />
        </Field>

        {notice ? (
          <p
            role="alert"
            className={cn(
              "mt-3 rounded-lg border px-3 py-2 text-xs font-medium",
              notice.ok ? "border-success/40 bg-success/10 text-success" : "border-danger/40 bg-danger/10 text-danger",
            )}
          >
            {notice.msg}
          </p>
        ) : null}
        <Button variant="primary" className="mt-4 w-full" loading={busy} onClick={() => void file()}>
          📮 File complaint
        </Button>
      </section>

      <section className="rounded-2xl border-2 border-fg/15 bg-bg-elevated p-5">
        <h3 className="text-sm font-black uppercase tracking-wider text-fg">My complaints</h3>
        {complaints.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-line-strong bg-white p-6 text-center text-sm text-muted">
            Nothing filed yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {complaints.map((c) => (
              <li key={c.id} className="rounded-xl border border-line bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone={STATUS_TONE[c.status]}>{c.status === "OPEN" ? "Under review" : c.status === "RESOLVED" ? "Resolved" : "Dismissed"}</Badge>
                  <span className="text-[10px] text-subtle">{new Date(c.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                </div>
                <p className="mt-1 text-sm font-bold text-fg">{c.subject}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted">{c.message}</p>
                {c.fixture ? <p className="mt-0.5 text-[10px] text-subtle">{c.fixture}</p> : null}
                {c.adminNote ? (
                  <p className="mt-1.5 rounded-lg bg-brand/5 px-2 py-1.5 text-[11px] text-brand-deep">
                    <span className="font-black">Admin:</span> {c.adminNote}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* --------------------------------- profile -------------------------------- */

/** Resize a chosen image in the browser to a square-ish ≤400px JPEG data URL. */
function fileToResizedDataUrl(file: File, max = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image"));
    };
    img.src = url;
  });
}

function ProfilePanel({
  name,
  avatar,
  onAvatar,
}: {
  name: string;
  avatar: string | null;
  onAvatar: (url: string | null) => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      const r = await uploadAvatarAction(dataUrl);
      if (r.ok) onAvatar(r.data.imageUrl);
      else setError(r.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that image.");
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    setBusy(true);
    setError(null);
    const r = await removeAvatarAction();
    setBusy(false);
    if (r.ok) onAvatar(null);
    else setError(r.error);
  }

  return (
    <div className="mt-5 max-w-md rounded-2xl border-2 border-fg/15 bg-bg-elevated p-5">
      <h3 className="text-sm font-black uppercase tracking-wider text-fg">Profile photo</h3>
      <p className="mt-1 text-xs text-muted">Upload a headshot from your device — it is resized to 400px automatically.</p>
      <div className="mt-4 flex items-center gap-4">
        <Avatar name={name} src={avatar} size={88} />
        <div className="space-y-2">
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => void onPick(e)} />
          <Button variant="primary" loading={busy} onClick={() => inputRef.current?.click()}>
            📤 Upload photo
          </Button>
          {avatar ? (
            <Button variant="ghost" onClick={() => void onRemove()}>
              Remove photo
            </Button>
          ) : null}
        </div>
      </div>
      {error ? <p className="mt-3 text-xs font-medium text-danger">{error}</p> : null}
    </div>
  );
}
