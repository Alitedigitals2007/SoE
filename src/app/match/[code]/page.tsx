import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { currentActor } from "@/lib/session";
import { buildSnapshot, loadMatchFullByCode } from "@/lib/match/snapshot";
import { TopBar } from "@/components/app";
import { Arena } from "@/components/match/Arena";

export const dynamic = "force-dynamic";

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
