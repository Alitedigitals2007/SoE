import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { playerStats } from "@/lib/platform/engine";
import { PublicShell } from "@/components/site";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PlayerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!exists) notFound();
  const stats = await playerStats(id);
  if (!stats) notFound();

  return (
    <PublicShell>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <span aria-hidden className="grid size-14 place-items-center rounded-2xl brand-gradient text-2xl font-black text-white shadow-md">
              {stats.name.slice(0, 1)}
            </span>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-fg">{stats.name}</h1>
              <div className="mt-1 flex flex-wrap gap-2">
                <Badge tone="pitch">Player</Badge>
                {stats.teams.map((t) => (
                  <Badge key={t.slug} tone="info">
                    {t.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <Link href="/compare" className="inline-flex h-10 items-center rounded-lg bg-surface px-4 text-sm font-semibold text-fg hover:bg-line">
            ⚖ Compare
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 rounded-2xl border border-line bg-white p-5 text-center shadow-sm sm:grid-cols-4">
          <StatCell label="Goals" value={stats.goals} accent="text-brand" icon="⚽" />
          <StatCell label="Matches" value={stats.matches} />
          <StatCell label="Wins" value={stats.wins} accent="text-success" />
          <StatCell label="Teams" value={stats.teams.length} />
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-bold text-fg">Recent results</h2>
          {stats.recent.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No finished matches yet.</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {stats.recent.map((r, i) => (
                <li key={i}>
                  <Link href={`/match/${r.code}`} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm transition-colors hover:border-brand/40">
                    <span className="font-medium text-fg">vs {r.opponent}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-black tabular-nums text-fg">{r.myScore}–{r.oppScore}</span>
                      <ResultPill r={r.result} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PublicShell>
  );
}

function StatCell({ label, value, accent, icon }: { label: string; value: number | string; accent?: string; icon?: string }) {
  return (
    <div>
      <p className={`text-2xl font-black tabular-nums ${accent ?? "text-fg"}`}>
        {icon ? `${icon} ` : ""}
        {value}
      </p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">{label}</p>
    </div>
  );
}

function ResultPill({ r }: { r: "W" | "D" | "L" }) {
  const cls = r === "W" ? "text-success" : r === "L" ? "text-danger" : "text-muted";
  return <span className={`rounded-md bg-surface px-1.5 py-0.5 text-xs font-black ${cls}`}>{r}</span>;
}
