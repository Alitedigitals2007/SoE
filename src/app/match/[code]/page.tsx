import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { currentActor } from "@/lib/session";
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
  const user = await requireRole();
  const { code } = await params;
  const match = await loadMatchFullByCode(code);
  if (!match) notFound();
  const actor = await currentActor();
  const snapshot = buildSnapshot(match, { role: actor?.role ?? "PUBLIC", userId: actor?.userId ?? null });

  return (
    <>
      <TopBar name={user.name} role={user.role} />
      <main className="pb-10">
        <Arena code={match.code} initial={snapshot} />
      </main>
    </>
  );
}
