import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { eligiblePlayersForCompetition, fantasyBoard, MAX_FANTASY_PICKS } from "@/lib/platform/engine";
import { PublicShell } from "@/components/site";
import { Badge } from "@/components/ui";
import { FantasyPicker, type EligiblePlayer } from "@/components/fantasy";

export const dynamic = "force-dynamic";

export default async function FantasyCompetition({ params }: { params: Promise<{ competitionId: string }> }) {
  const { competitionId } = await params;
  const comp = await prisma.competition.findUnique({
    where: { id: competitionId },
    include: { _count: { select: { teams: true, matches: true } } },
  });
  if (!comp) notFound();

  const session = await auth();
  const user = session?.user ?? null;
  const board = await fantasyBoard(competitionId);
  const boardData = board.map((e, i) => ({ rank: i + 1, name: e.name, owner: e.user.name, points: e.points, picks: e._count.picks, mine: e.userId === user?.id }));

  let eligible: EligiblePlayer[] = [];
  let myEntry: { id: string; name: string; points: number } | null = null;
  let myPicks: string[] = [];

  if (user) {
    const data = await eligiblePlayersForCompetition(competitionId);
    if (data) eligible = data.players;
    const mine = board.find((e) => e.userId === user.id) ?? null;
    if (mine) {
      myEntry = { id: mine.id, name: mine.name, points: mine.points };
      const picks = await prisma.fantasyPick.findMany({
        where: { entryId: mine.id },
        select: { playerUserId: true },
      });
      myPicks = picks.map((p) => p.playerUserId);
    }
  }

  const myRank = boardData.find((b) => b.mine)?.rank ?? null;

  return (
    <PublicShell>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-black tracking-tight text-fg">{comp.name} · Fantasy</h1>
          <Badge tone="gold">Season {comp.season}</Badge>
          {comp.status === "FINISHED" ? <Badge tone="neutral">Finished</Badge> : <Badge tone="success">Open</Badge>}
        </div>
        <p className="mt-1 text-muted">Pick up to {MAX_FANTASY_PICKS} players from the competition. Each goal they score = 10 fantasy points.</p>

        {!user ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/30 bg-brand/5 p-5">
            <div>
              <p className="font-bold text-fg">Join the game</p>
              <p className="text-sm text-muted">Create an entry and start picking your scorers.</p>
            </div>
            <div className="flex gap-2">
              <Link href="/register" className="inline-flex h-10 items-center rounded-lg brand-gradient px-4 text-sm font-semibold text-white shadow-sm hover:brightness-105">
                Register free
              </Link>
              <Link href="/login" className="inline-flex h-10 items-center rounded-lg bg-surface px-4 text-sm font-semibold text-fg hover:bg-line">
                Sign in
              </Link>
            </div>
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section>
            <h2 className="text-lg font-bold text-fg">Your entry</h2>
            {user ? (
              <div className="mt-3 rounded-2xl border border-line bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-fg">
                    {myEntry?.name ?? `${user.name}'s XI`}
                    {!myEntry ? <span className="ml-2 rounded-md bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">New</span> : null}
                  </p>
                  {myEntry ? <Badge tone="gold">{myEntry.points} pts</Badge> : null}
                </div>
                {myRank ? <p className="mt-1 text-sm text-muted">#{myRank} on the leaderboard</p> : null}
                {comp.status !== "FINISHED" ? (
                  <div className="mt-4">
                    <FantasyPicker competitionId={competitionId} players={eligible} existing={myPicks} maxPicks={MAX_FANTASY_PICKS} disabled={false} />
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted">Final scores — this competition has closed.</p>
                )}
              </div>
            ) : null}
          </section>

          <section>
            <h2 className="text-lg font-bold text-fg">Leaderboard</h2>
            {boardData.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-line-strong bg-white p-6 text-center text-sm text-muted">
                No entries yet — be the first manager.
              </p>
            ) : (
              <ol className="mt-3 space-y-1.5">
                {boardData.map((e) => (
                  <li key={e.rank}>
                    <div className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 ${e.mine ? "border-brand bg-brand/10" : "border-line bg-white"}`}>
                      <span className="w-6 shrink-0 text-center text-sm font-black text-subtle">{e.rank}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-fg">
                          {e.name}
                          {e.mine ? <span className="ml-1 text-xs font-bold text-brand">(you)</span> : null}
                        </span>
                        <span className="block text-xs text-muted">by {e.owner} · {e.picks} picks</span>
                      </span>
                      <span className="shrink-0 text-lg font-black tabular-nums text-brand">{e.points}</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </PublicShell>
  );
}
