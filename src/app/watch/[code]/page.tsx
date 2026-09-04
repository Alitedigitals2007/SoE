import Link from "next/link";
import { notFound } from "next/navigation";
import { buildSnapshot, loadMatchFullByCode } from "@/lib/match/snapshot";
import { Arena } from "@/components/match/Arena";

export const dynamic = "force-dynamic";

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
