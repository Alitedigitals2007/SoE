import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { allOdds, formGuide } from "@/lib/bet/odds";
import { ensureWallet } from "@/lib/bet/wallet";
import { PublicShell } from "@/components/site";
import { Badge } from "@/components/ui";
import { BetTerminal, type BetMatch, type BetRow, type LeaderRow, type TxnRow } from "@/components/bet";
import { selectionLabel } from "@/lib/bet/labels";

export const dynamic = "force-dynamic";

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
    rawMatches.map(async (m) => {
      const [all, form] = await Promise.all([allOdds(m), formGuide(m.homeTeamId, m.awayTeamId)]);
      return {
        id: m.id,
        fixture: `${m.homeName} v ${m.awayName}`,
        homeName: m.homeName,
        awayName: m.awayName,
        competition: m.competition?.name ?? null,
        kickoff: m.scheduledAt!.toISOString(),
        odds: all.match,
        goals: all.goals,
        doubleChance: all.doubleChance,
        drawNoBet: all.drawNoBet,
        halfResult: all.halfResult,
        halfFull: all.halfFull,
        teamTotals: all.teamTotals,
        form,
      };
    }),
  );

  // Public leaderboard: top virtual-point balances.
  const topUsers = await prisma.user.findMany({
    where: { virtualPoints: { not: null } },
    orderBy: [{ virtualPoints: "desc" }, { createdAt: "asc" }],
    take: 20,
    select: { id: true, name: true, virtualPoints: true },
  });
  const leaderboard: LeaderRow[] = topUsers.map((u, i) => ({
    rank: i + 1,
    name: u.name,
    balance: u.virtualPoints ?? 0,
    mine: u.id === user?.id,
  }));

  let balance = 0;
  let bets: BetRow[] = [];
  let txns: TxnRow[] = [];
  let myRank: number | null = null;
  let claimedToday = false;

  if (user) {
    balance = (await ensureWallet(prisma, user.id)).balance;
    const [rawBets, rawTxns, lastClaim, richerThanMe] = await Promise.all([
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
      prisma.walletTransaction.findFirst({
        where: { userId: user.id, kind: "DAILY_CLAIM" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.user.count({ where: { virtualPoints: { gt: balance } } }),
    ]);
    myRank = richerThanMe + 1;
    claimedToday = !!lastClaim && lastClaim.createdAt.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
    bets = rawBets.map((b) => {
      const legs = Array.isArray(b.legs)
        ? (b.legs as { fixture?: string; label?: string; odds?: number }[]).map((l) => ({
            fixture: l.fixture ?? "",
            label: l.label ?? "",
            odds: Number(l.odds ?? 0),
          }))
        : undefined;
      return {
        id: b.id,
        code: b.code,
        fixture: `${b.match.homeName} v ${b.match.awayName}`,
        market: b.market,
        selectionLabel: selectionLabel(b.market, b.selection, legs?.length),
        odds: Number(b.odds),
        stake: b.stake,
        potentialReturn: b.potentialReturn,
        status: b.status,
        payout: b.payout,
        placedAt: b.placedAt.toISOString(),
        result: b.match.status === "FINISHED" ? `${b.match.homeScore}–${b.match.awayScore}` : null,
        legs,
      };
    });
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
          Predict results, exact scores and goal markets with virtual points — auto odds, no money, ever.
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
          <BetTerminal
            signedIn={!!user}
            balance={balance}
            matches={matches}
            bets={bets}
            txns={txns}
            leaderboard={leaderboard}
            myRank={myRank}
            claimedToday={claimedToday}
          />
        </div>

        <section className="mt-10 rounded-2xl border border-line bg-white p-5">
          <h2 className="text-sm font-black uppercase tracking-wider text-fg">How it works</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            <li>Every new account gets <strong className="text-fg">100 virtual points</strong> — these are not real money.</li>
            <li>Markets open on every scheduled match: <strong className="text-fg">home win / draw / away win</strong>, <strong className="text-fg">exact scores (0–0 up to 10–0)</strong>, <strong className="text-fg">over/under totals</strong> and <strong className="text-fg">both-teams-to-score</strong> — plus <strong className="text-fg">double chance</strong>, <strong className="text-fg">draw-no-bet</strong>, <strong className="text-fg">half-time result</strong>, <strong className="text-fg">half-time / full-time</strong> and <strong className="text-fg">team goal totals</strong>.</li>
            <li>Add 2–6 selections from different matches for an <strong className="text-fg">accumulator</strong> — the odds multiply.</li>
            <li>Stake up to <strong className="text-fg">500 points</strong> per bet (max 5 open bets per match, 10 open accumulators).</li>
            <li>Odds are automatic — league matches use the standings, other matches standard prices; exact scores and totals run on an expected-goals model. Each card shows both teams&apos; recent form.</li>
            <li>Betting closes at kick-off and settles at full time from the 10-question scoreline (penalty shootouts don&apos;t affect bets).</li>
            <li>A winning bet returns <strong className="text-fg">stake × odds</strong> in points; every movement appears in your Wallet history.</li>
            <li><strong className="text-fg">Claim 20 free points daily</strong> from the Wallet tab, and fantasy keeps paying too — every goal by a player you picked adds <strong className="text-fg">+10 points</strong> straight to your wallet.</li>
          </ul>
        </section>
      </div>
    </PublicShell>
  );
}
