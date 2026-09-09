import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { buildSnapshot, loadMatchFullByCode } from "@/lib/match/snapshot";
import { TopBar } from "@/components/app";
import { Arena } from "@/components/match/Arena";

export const dynamic = "force-dynamic";

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
      <main className="pb-10">
        <Arena code={match.code} initial={snapshot} />
      </main>
    </>
  );
}
