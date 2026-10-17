import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/app";
import { Badge } from "@/components/ui";
import { LineupManager, QuestionsManager, type LineupPlayer, type QRow } from "@/components/referee";
import { SetupChecklist, SetupStep } from "@/components/SetupProgress";
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

  const startersFor = (side: TeamSide) =>
    match.roster.filter((r) => r.team === side && r.role === "STARTER").length;
  const homeStarters = startersFor("HOME");
  const awayStarters = startersFor("AWAY");
  const captainsReady = (["HOME", "AWAY"] as const).every((s) =>
    match.roster.some((r) => r.team === s && r.isCaptain),
  );
  const lineupReady = homeStarters >= 5 && awayStarters >= 5 && captainsReady;
  const questionsReady = match.questions.length >= 10;

  const missing: string[] = [];
  if (!lineupReady)
    missing.push(
      captainsReady
        ? `Mark 5 starters per side (${match.homeName} ${homeStarters}/5 · ${match.awayName} ${awayStarters}/5).`
        : "Pick a captain for each side.",
    );
  if (!questionsReady)
    missing.push(`Place 10 questions into slots 1–10 (${match.questions.length}/10 placed).`);

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

        <nav className="mt-6 grid gap-2 sm:grid-cols-2" aria-label="Setup progress">
          <SetupStep href="#questions" n={1} label="Questions" detail={`${match.questions.length}/10`} done={questionsReady} />
          <SetupStep href="#lineup" n={2} label="Starters & captain" detail={`${homeStarters}/5 · ${awayStarters}/5`} done={lineupReady} />
        </nav>

        <SetupChecklist missing={missing} />

        <div className="mt-6 space-y-6">
          <div id="questions" className="scroll-mt-24">
            <QuestionsManager code={match.code} questions={questions} />
          </div>
          <div id="lineup" className="scroll-mt-24">
            <LineupManager
              code={match.code}
              homeName={match.homeName}
              awayName={match.awayName}
              teams={{ HOME: playersFor("HOME"), AWAY: playersFor("AWAY") }}
            />
          </div>
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
