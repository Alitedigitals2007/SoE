import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { oddsForMatch } from "@/lib/bet/odds";
import { ensureWallet } from "@/lib/bet/wallet";
import { PublicShell } from "@/components/site";
import { Badge } from "@/components/ui";
import { BetTerminal, type BetMatch, type BetRow, type TxnRow } from "@/components/bet";

export const dynamic = "force-dynamic";

const selectionLabel = (market: string, selection: string): string => {
  if (market === "MATCH_RESULT")
    return { HOME: "Home win", DRAW: "Draw", AWAY: "Away win" }[selection] ?? selection;
  return `Score ${selection}`;
};

export default async function BetPage() {
  const session = await auth();
  const user = session?.user ?? null;

  const rawMatches = await prisma.match.findMany({
    where: { status: "DRAFT", scheduledAt: { not: null } },
    orderBy: { scheduledAt: "asc" },
    take: 30,
    select: {
      id: true,
      code: true,
      homeName: true,
      awayName: true,
      scheduledAt: true,
      competitionId: true,
      homeTeamId: true,
      awayTeamId: true,
      competition: { select: { name: true } },
    },
  });

  const matches: BetMatch[] = await Promise.all(
    rawMatches.map(async (m) => ({
      id: m.id,
      fixture: `${m.homeName} v ${m.awayName}`,
      homeName: m.homeName,
      awayName: m.awayName,
      competition: m.competition?.name ?? null,
      kickoff: m.scheduledAt!.toISOString(),
      odds: await oddsForMatch(m),
    })),
  );

  let balance = 0;
  let bets: BetRow[] = [];
  let txns: TxnRow[] = [];

  if (user) {
    balance = (await ensureWallet(prisma, user.id)).balance;
    const [rawBets, rawTxns] = await Promise.all([
      prisma.bet.findMany({
        where: { userId: user.id },
        orderBy: { placedAt: "desc" },
        take: 50,
        include: {
          match: { select: { homeName: true, awayName: true, status: true, homeScore: true, awayScore: true } },
        },
      }),
      prisma.walletTransaction.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);
    bets = rawBets.map((b) => ({
      id: b.id,
      fixture: `${b.match.homeName} v ${b.match.awayName}`,
      market: b.market,
      selectionLabel: selectionLabel(b.market, b.selection),
      odds: Number(b.odds),
      stake: b.stake,
      potentialReturn: b.potentialReturn,
      status: b.status,
      payout: b.payout,
      placedAt: b.placedAt.toISOString(),
      result: b.match.status === "FINISHED" ? `${b.match.homeScore}–${b.match.awayScore}` : null,
    }));
    txns = rawTxns.map((t) => ({
      id: t.id,
      amount: t.amount,
      balanceAfter: t.balanceAfter,
      kind: t.kind,
      note: t.note,
      createdAt: t.createdAt.toISOString(),
    }));
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-black tracking-tight text-fg">Bet</h1>
          <Badge tone="gold">Virtual points</Badge>
          {user ? <Badge tone="success">Balance {balance}</Badge> : null}
        </div>
        <p className="mt-1 text-muted">
          Predict match results and exact scores with virtual points — auto odds, no money, ever.
        </p>

        {!user ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/30 bg-brand/5 p-5">
            <div>
              <p className="font-bold text-fg">Get 100 welcome points</p>
              <p className="text-sm text-muted">Open a free account and your wallet starts with 100 points.</p>
            </div>
            <div className="flex gap-2">
              <Link href="/register?next=/bet" className="inline-flex h-10 items-center rounded-lg brand-gradient px-4 text-sm font-semibold text-white shadow-sm hover:brightness-105">
                Register free
              </Link>
              <Link href="/login?next=/bet" className="inline-flex h-10 items-center rounded-lg bg-surface px-4 text-sm font-semibold text-fg hover:bg-line">
                Sign in
              </Link>
            </div>
          </div>
        ) : null}

        <div className="mt-6">
          <BetTerminal signedIn={!!user} balance={balance} matches={matches} bets={bets} txns={txns} />
        </div>

        <section className="mt-10 rounded-2xl border border-line bg-white p-5">
          <h2 className="text-sm font-black uppercase tracking-wider text-fg">How it works</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            <li>Every new account gets <strong className="text-fg">100 virtual points</strong> — these are not real money.</li>
            <li>Markets open on every scheduled match: <strong className="text-fg">home win / draw / away win</strong> and <strong className="text-fg">exact scores</strong>.</li>
            <li>Odds are automatic — league matches use the standings, other matches standard prices. The score grid runs on an expected-goals model.</li>
            <li>Betting closes at kick-off and settles at full time from the 10-question scoreline (penalty shootouts don&apos;t affect bets).</li>
            <li>A winning bet returns <strong className="text-fg">stake × odds</strong> in points; every movement appears in your Wallet history.</li>
            <li>Fantasy keeps paying too: every goal by a player you picked adds <strong className="text-fg">+10 points</strong> straight to your wallet.</li>
          </ul>
        </section>
      </div>
    </PublicShell>
  );
}
