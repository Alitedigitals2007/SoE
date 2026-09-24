import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/app";
import { Badge } from "@/components/ui";
import {
  AdminTabs,
  GoalRoundsEditor,
  PostponeEditor,
  RosterManager,
  ScheduleEditor,
  ScoreOverrideEditor,
  type AvailablePlayer,
  type GoalRoundRow,
  type RosterPlayer,
} from "@/components/admin";
import { formatKickoffWat } from "@/lib/format";
import { StatusBadge } from "../../page";

export const dynamic = "force-dynamic";

export default async function AdminMatchPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await requireRole(["ADMIN"]);
  const { code } = await params;
  const match = await prisma.match.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      referee: { select: { name: true } },
      roster: { include: { user: { select: { id: true, name: true } } }, orderBy: [{ team: "asc" }, { number: "asc" }] },
      rounds: {
        where: { status: "DECIDED" },
        orderBy: { number: "asc" },
        include: {
          question: { select: { text: true } },
          submissions: { orderBy: { seq: "asc" }, include: { player: { include: { user: { select: { name: true } } } } } },
          goalSubmission: { include: { player: { include: { user: { select: { name: true } } } } } },
          assistPlayer: { include: { user: { select: { name: true } } } },
        },
      },
    },
  });
  if (!match) notFound();

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
  const scheduledAt = match.scheduledAt ? match.scheduledAt.toISOString() : null;
  const started = match.status !== "DRAFT";

  const goalRounds: GoalRoundRow[] = match.rounds.map((r) => {
    const toRow = (s: NonNullable<typeof r.goalSubmission>) => ({
      submissionId: s.id,
      userId: s.player.userId,
      name: s.player.user.name,
      team: s.player.team,
      answer: s.answer,
    });
    const submissions = r.submissions.map(toRow);
    return {
      roundId: r.id,
      number: r.number,
      decision: r.decision as "GOAL" | "NO_GOAL",
      questionText: r.question.text,
      scorer: r.goalSubmission ? toRow(r.goalSubmission) : null,
      assist: r.assistPlayer ? { userId: r.assistPlayer.userId, name: r.assistPlayer.user.name } : null,
      submissions,
    };
  });

  const tabs = [
    ...(started
      ? [
          {
            key: "scores",
            label: "Scores & goals",
            badge: goalRounds.length,
            content: (
              <div className="space-y-4">
                <ScoreOverrideEditor
                  code={match.code}
                  homeName={match.homeName}
                  awayName={match.awayName}
                  homeScore={match.homeScore}
                  awayScore={match.awayScore}
                />
                <GoalRoundsEditor
                  code={match.code}
                  homeName={match.homeName}
                  awayName={match.awayName}
                  rounds={goalRounds}
                  roster={roster}
                />
              </div>
            ),
          },
        ]
      : [
          {
            key: "schedule",
            label: "Schedule & prep",
            content: (
              <div className="space-y-4">
                <ScheduleEditor code={match.code} scheduledAt={scheduledAt} />
                <PostponeEditor code={match.code} scheduledAt={scheduledAt} />
              </div>
            ),
          },
        ]),
    {
      key: "roster",
      label: "Roster",
      badge: roster.length,
      content: (
        <RosterManager
          code={match.code}
          status={match.status}
          homeName={match.homeName}
          awayName={match.awayName}
          roster={roster}
          available={available}
        />
      ),
    },
  ];

  return (
    <>
      <TopBar name={user.name} role={user.role} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-fg">
              {match.homeName} <span className="text-subtle">v</span> {match.awayName}
            </h1>
            <p className="text-sm text-muted">
              Match code <span className="font-semibold text-gold">{match.code}</span> · {match.referee?.name ?? "No referee"}
              {started ? <> · <span className="font-black tabular-nums text-fg">{match.homeScore}–{match.awayScore}</span></> : null}
            </p>
            {scheduledAt ? (
              <p className="mt-0.5 text-xs text-muted">🗓️ Kick-off: {formatKickoffWat(scheduledAt)}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={match.status} />
            <Badge tone="neutral">{match.countdownSeconds}s / question</Badge>
            {!started ? (
              <Link href={`/admin/matches/${match.code}/setup`} className="inline-flex h-10 items-center rounded-lg brand-gradient px-4 text-sm font-semibold text-white hover:brightness-105">
                Setup match →
              </Link>
            ) : null}
            <Link href={`/match/${match.code}`} className="inline-flex h-10 items-center rounded-lg bg-surface px-4 text-sm font-medium text-fg hover:bg-bg-raised">
              Open match →
            </Link>
          </div>
        </div>

        <div className="mt-5">
          <AdminTabs tabs={tabs} />
        </div>
      </main>
    </>
  );
}
