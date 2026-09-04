import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/app";
import { Badge } from "@/components/ui";
import { LineupManager, QuestionsManager, type LineupPlayer, type QRow } from "@/components/referee";
import type { Role, TeamSide } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function RefereeSetupPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await requireRole(["REFEREE"]);
  const { code } = await params;
  const match = await prisma.match.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      roster: { include: { user: { select: { id: true, name: true } } }, orderBy: [{ team: "asc" }, { number: "asc" }] },
      questions: { orderBy: { order: "asc" } },
    },
  });

  if (!match) notFound();
  if (match.refereeId !== user.id) return <NotYourMatch name={user.name} role={user.role} />;
  if (match.status !== "DRAFT") return <AlreadyLive name={user.name} role={user.role} code={match.code} status={match.status} />;

  const questions: QRow[] = match.questions.map((q) => ({
    id: q.id,
    order: q.order,
    text: q.text,
    referenceAnswer: q.referenceAnswer,
    roundNumber: q.roundNumber,
  }));

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

  return (
    <>
      <TopBar name={user.name} role={user.role} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-fg">Match setup</h1>
            <p className="text-sm text-muted">
              {match.homeName} v {match.awayName} · Code <span className="font-semibold text-gold">{match.code}</span> · {match.countdownSeconds}s per question
            </p>
          </div>
          <Link href={`/match/${match.code}`} className="inline-flex h-10 items-center rounded-lg bg-surface px-4 text-sm font-medium text-fg hover:bg-bg-raised">
            Spectate →
          </Link>
        </div>

        <div className="mt-6 space-y-6">
          <QuestionsManager code={match.code} questions={questions} />
          <LineupManager
            code={match.code}
            homeName={match.homeName}
            awayName={match.awayName}
            teams={{ HOME: playersFor("HOME"), AWAY: playersFor("AWAY") }}
          />
        </div>

        <p className="mt-6 text-xs text-subtle">
          Preparing 20 questions is fine — only the ten placed in slots 1–10 are played. Kick-off is locked until both teams
          have five starters and a captain and all ten slots are filled.
        </p>
      </main>
    </>
  );
}

function NotYourMatch({ name, role }: { name: string; role: Role }) {
  return (
    <>
      <TopBar name={name} role={role} />
      <main className="mx-auto max-w-lg px-4 py-10 text-center">
        <Badge tone="danger">Not your match</Badge>
        <p className="mt-3 text-sm text-muted">This match is assigned to another referee.</p>
        <Link href="/referee" className="mt-4 inline-block text-sm text-gold hover:underline">
          ← Back to your matches
        </Link>
      </main>
    </>
  );
}

function AlreadyLive({ name, role, code, status }: { name: string; role: Role; code: string; status: string }) {
  return (
    <>
      <TopBar name={name} role={role} />
      <main className="mx-auto max-w-lg px-4 py-10 text-center">
        <Badge tone="warning">Match {status === "LIVE" ? "is live" : "has finished"}</Badge>
        <p className="mt-3 text-sm text-muted">Setup is locked once the match starts.</p>
        <Link href={`/match/${code}`} className="mt-4 inline-block text-sm text-gold hover:underline">
          Go to the match →
        </Link>
      </main>
    </>
  );
}
