import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/app";
import { Badge } from "@/components/ui";
import { StatusBadge } from "../../../page";
import { RosterManager, ScheduleEditor, type AvailablePlayer, type RosterPlayer } from "@/components/admin";
import { LineupManager, QuestionsManager, type LineupPlayer, type QRow } from "@/components/referee";
import type { TeamSide } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function AdminMatchSetupPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await requireRole(["ADMIN"]);
  const { code } = await params;
  const match = await prisma.match.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      referee: { select: { name: true } },
      roster: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: [{ team: "asc" }, { number: "asc" }],
      },
      questions: { orderBy: { order: "asc" } },
    },
  });
  if (!match) notFound();
  if (match.status !== "DRAFT")
    return (
      <LockedView
        name={user.name}
        code={match.code}
        status={match.status}
        homeName={match.homeName}
        awayName={match.awayName}
      />
    );

  const availableRows = await prisma.user.findMany({
    where: { role: "PLAYER", rosterSlots: { none: { matchId: match.id } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });

  const roster: RosterPlayer[] = match.roster.map((r) => ({
    userId: r.userId,
    name: r.user.name,
    team: r.team,
    number: r.number,
    role: r.role,
  }));
  const available: AvailablePlayer[] = availableRows.map((a) => ({ ...a }));

  const playersFor = (team: TeamSide): LineupPlayer[] =>
    match.roster
      .filter((r) => r.team === team)
      .map((r) => ({
        userId: r.userId,
        name: r.user.name,
        number: r.number,
        role: r.role,
        isCaptain: r.isCaptain,
      }));

  const questions: QRow[] = match.questions.map((q) => ({
    id: q.id,
    order: q.order,
    text: q.text,
    referenceAnswer: q.referenceAnswer,
    roundNumber: q.roundNumber,
  }));

  const perSide = (side: TeamSide) =>
    match.roster.filter((r) => r.team === side).length;

  return (
    <>
      <TopBar name={user.name} role={user.role} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-fg">Match setup</h1>
            <p className="text-sm text-muted">
              {match.homeName} <span className="text-subtle">v</span> {match.awayName} · Code{" "}
              <span className="font-semibold text-gold">{match.code}</span> · {match.referee?.name ?? "No referee yet"} ·{" "}
              {match.countdownSeconds}s per question
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={match.status} />
            {match.scheduledAt ? (
              <Badge tone="warning">
                ⏱ {new Date(match.scheduledAt.getTime() + 3600_000).toLocaleString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} WAT
              </Badge>
            ) : null}
            <Link
              href={`/admin/matches/${match.code}`}
              className="inline-flex h-10 items-center rounded-lg bg-surface px-4 text-sm font-medium text-fg hover:bg-bg-raised"
            >
              ← Back
            </Link>
            <Link
              href={`/match/${match.code}`}
              className="inline-flex h-10 items-center rounded-lg brand-gradient px-4 text-sm font-medium text-white hover:brightness-105"
            >
              Spectate →
            </Link>
          </div>
        </div>

        {match.status === "DRAFT" ? (
          <div className="mt-4">
            <ScheduleEditor code={match.code} scheduledAt={match.scheduledAt ? match.scheduledAt.toISOString() : null} />
          </div>
        ) : null}

        {/* Stepper summary */}
        <ol className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-bold uppercase tracking-wider text-muted">
          <Step n={1} label="Players on roster" done={perSide("HOME") >= 5 && perSide("AWAY") >= 5} />
          <Step n={2} label="Active XI + subs + captain" done={rosterCountReady(match.roster)} />
          <Step n={3} label="Questions (10 slots)" done={match.questions.length >= 10} />
        </ol>

        <div className="mt-6 space-y-6">
          <section className="rounded-2xl border-2 border-fg/15 bg-bg-elevated p-5 shadow-[4px_4px_0_rgba(11,32,48,.08)]">
            <div className="mb-4">
              <h2 className="font-display text-lg font-black uppercase tracking-wider text-fg">
                <span className="mr-2 text-brand">1.</span> Players
              </h2>
              <p className="text-sm text-muted">
                Assign the sixteen players — shirt 1–8 per team (8 on {match.homeName}, 8 on {match.awayName}).
              </p>
            </div>
            <RosterManager
              code={match.code}
              status={match.status}
              homeName={match.homeName}
              awayName={match.awayName}
              roster={roster}
              available={available}
            />
          </section>

          <section className="rounded-2xl border-2 border-fg/15 bg-bg-elevated p-5 shadow-[4px_4px_0_rgba(11,32,48,.08)]">
            <div className="mb-4">
              <h2 className="font-display text-lg font-black uppercase tracking-wider text-fg">
                <span className="mr-2 text-brand">2.</span> Active XI, subs &amp; captain
              </h2>
              <p className="text-sm text-muted">
                Mark five players <span className="font-semibold text-success">ACTIVE</span> per side (the rest are{" "}
                <span className="font-semibold text-warning">SUB</span>) and pick the captain.
              </p>
            </div>
            <LineupManager
              code={match.code}
              homeName={match.homeName}
              awayName={match.awayName}
              teams={{ HOME: playersFor("HOME"), AWAY: playersFor("AWAY") }}
            />
          </section>

          <section className="rounded-2xl border-2 border-fg/15 bg-bg-elevated p-5 shadow-[4px_4px_0_rgba(11,32,48,.08)]">
            <div className="mb-4">
              <h2 className="font-display text-lg font-black uppercase tracking-wider text-fg">
                <span className="mr-2 text-brand">3.</span> Questions
              </h2>
              <p className="text-sm text-muted">
                Add prepared questions and place ten of them into slots 1–10 — those are the ones played live.
              </p>
            </div>
            <QuestionsManager code={match.code} questions={questions} />
          </section>
        </div>

        <p className="mt-6 rounded-xl border border-line bg-bg-elevated px-4 py-3 text-xs text-subtle">
          The referee only controls the live match — kick-off, timing and decisions. This page is where the whole thing is
          built. Setup stays unlocked until kick-off.
        </p>
      </main>
    </>
  );
}

function Step({ n, label, done }: { n: number; label: string; done: boolean }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={
          done
            ? "grid size-6 place-items-center rounded-full bg-success text-xs text-white"
            : "grid size-6 place-items-center rounded-full bg-surface text-xs text-muted"
        }
      >
        {done ? "✓" : n}
      </span>
      <span className={done ? "text-success" : "text-muted"}>{label}</span>
    </li>
  );
}

function rosterCountReady(roster: { role: string; isCaptain: boolean }[]) {
  return roster.filter((r) => r.isCaptain).length === 2;
}

function LockedView({
  name,
  code,
  status,
  homeName,
  awayName,
}: {
  name: string;
  code: string;
  status: string;
  homeName: string;
  awayName: string;
}) {
  return (
    <>
      <TopBar name={name} role="ADMIN" />
      <main className="mx-auto max-w-lg px-4 py-10 text-center">
        <Badge tone={status === "LIVE" ? "success" : "neutral"}>{status === "LIVE" ? "Match is live" : "Match finished"}</Badge>
        <h1 className="mt-3 text-xl font-black text-fg">
          {homeName} v {awayName}
        </h1>
        <p className="mt-2 text-sm text-muted">Setup is locked once the match starts.</p>
        <Link href={`/match/${code}`} className="mt-4 inline-block text-sm text-gold hover:underline">
          Go to the match →
        </Link>
      </main>
    </>
  );
}
