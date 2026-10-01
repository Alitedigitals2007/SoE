import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildSnapshot, loadMatchFullByCode } from "@/lib/match/snapshot";
import { TopBar } from "@/components/app";
import { Arena } from "@/components/match/Arena";

export const dynamic = "force-dynamic";

/**
 * What the second leg of a two-legged tie is chasing. Returns null unless this
 * fixture really is a return leg — a one-legged cup never shows a banner.
 */
async function loadTieState(cupTie: string | null) {
  if (!cupTie) return null;
  const legs = await prisma.match.findMany({
    where: { cupTie },
    select: {
      cupLeg: true,
      homeTeamId: true,
      awayTeamId: true,
      homeName: true,
      awayName: true,
      homeScore: true,
      awayScore: true,
      status: true,
    },
    orderBy: [{ cupLeg: "asc" }, { createdAt: "asc" }],
  });
  if (legs.length < 2) return null;

  const first = legs[0];
  const aId = first.homeTeamId;
  const aName = first.homeName;
  const bName = first.awayName;

  let a = 0;
  let b = 0;
  let played = 0;
  for (const leg of legs) {
    if (leg.status !== "FINISHED") continue;
    played++;
    const aIsHome = leg.homeTeamId === aId;
    a += aIsHome ? leg.homeScore : leg.awayScore;
    b += aIsHome ? leg.awayScore : leg.homeScore;
  }

  const diff = a - b;
  const hint =
    played === 0
      ? "First leg still to be played"
      : diff === 0
        ? "Level — this leg decides it"
        : diff > 0
          ? `${bName} must overturn a ${diff}-goal deficit`
          : `${aName} must overturn a ${-diff}-goal deficit`;

  return { aName, bName, a, b, played, hint };
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const match = await loadMatchFullByCode(code);
  if (!match) return { title: "Match not found" };
  const title = `${match.homeName} vs ${match.awayName} — Stadium of Elite`;
  const description =
    match.status === "LIVE"
      ? `LIVE: ${match.homeName} ${match.homeScore} – ${match.awayScore} ${match.awayName}. Watch the quiz football match live.`
      : match.status === "FINISHED"
        ? `${match.homeName} ${match.homeScore} – ${match.awayScore} ${match.awayName}. Full-time result.`
        : `${match.homeName} vs ${match.awayName} — upcoming quiz football match.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: `/match/${code}/opengraph-image`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`/match/${code}/opengraph-image`],
    },
  };
}

export default async function MatchArenaPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const match = await loadMatchFullByCode(code);
  if (!match) notFound();

  const tie = match.cupTie ? await loadTieState(match.cupTie) : null;

  const session = await auth();
  const user = session?.user ?? null;
  const snapshot = buildSnapshot(
    match,
    user ? { role: user.role, userId: user.id } : { role: "PUBLIC", userId: null },
  );

  return (
    <>
      {user ? (
        <TopBar name={user.name} role={user.role} />
      ) : (
        <div className="border-b-2 border-fg bg-bg/95">
          <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2 text-sm font-bold tracking-wide text-fg">
              <span aria-hidden className="grid size-6 place-items-center rounded-md bg-gold text-gold-ink">
                ⚽
              </span>
              <span>
                STADIUM <span className="text-gold">OF ELITE</span>
              </span>
            </Link>
            <p className="text-xs text-subtle">Public viewing · sign in to referee or captain</p>
          </div>
        </div>
      )}
      {tie && (match.cupLeg === 1 || match.cupLeg === 2) ? (
        <div className="border-b border-line bg-bg-elevated">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2.5 text-xs">
            <span className="font-black uppercase tracking-widest text-brand">
              {match.cupLeg === 2 ? "Aggregate" : "First leg of two"}
            </span>
            {match.cupLeg === 2 ? (
              <>
                <span className="font-bold text-fg">
                  {tie.aName} <span className="tabular-nums">{tie.a}</span>
                  <span className="mx-1 text-subtle">–</span>
                  <span className="tabular-nums">{tie.b}</span> {tie.bName}
                </span>
                <span className="text-muted">{tie.hint}</span>
              </>
            ) : (
              <span className="text-muted">This tie is settled over two legs</span>
            )}
            <span className="text-subtle">No away goals — a level aggregate goes to penalties.</span>
          </div>
        </div>
      ) : null}
      <main className="pb-10">
        <Arena code={match.code} initial={snapshot} />
      </main>
    </>
  );
}
