import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildSnapshot, loadMatchFullByCode } from "@/lib/match/snapshot";
import { Arena } from "@/components/match/Arena";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const match = await loadMatchFullByCode(code);
  if (!match) return { title: "Match not found" };
  const title = `Watch: ${match.homeName} vs ${match.awayName} — Stadium of Elite`;
  const description =
    match.status === "LIVE"
      ? `Watch LIVE: ${match.homeName} ${match.homeScore} – ${match.awayScore} ${match.awayName}. Public quiz football viewing.`
      : match.status === "FINISHED"
        ? `Watch: ${match.homeName} ${match.homeScore} – ${match.awayScore} ${match.awayName}. Full-time result.`
        : `Watch: ${match.homeName} vs ${match.awayName} — upcoming quiz football match.`;
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

export default async function WatchPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const match = await loadMatchFullByCode(code);
  if (!match) notFound();
  const snapshot = buildSnapshot(match, { role: "PUBLIC", userId: null });

  return (
    <main className="pb-10">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-sm font-bold tracking-wide text-fg">
          <span aria-hidden className="grid size-6 place-items-center rounded-md bg-gold text-gold-ink">
            ⚽
          </span>
          <span>
            STADIUM <span className="text-gold">OF ELITE</span>
          </span>
        </Link>
        <p className="text-xs text-subtle">Public viewing · answers stay anonymous until the referee decides</p>
      </div>
      <Arena code={match.code} initial={snapshot} />
    </main>
  );
}
