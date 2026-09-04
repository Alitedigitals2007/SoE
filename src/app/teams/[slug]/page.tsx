import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { teamStats } from "@/lib/platform/engine";
import { PublicShell } from "@/components/site";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TeamDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true, name: true, code: true } });
  if (!team) notFound();
  const stats = await teamStats(team.id);
  if (!stats) notFound();

  return (
    <PublicShell>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-fg">{stats.name}</h1>
            <p className="text-sm text-muted">
              Code <Badge tone="neutral">{stats.code}</Badge> · {stats.p} matches played
            </p>
          </div>
          <Link href="/compare" className="inline-flex h-10 items-center rounded-lg bg-surface px-4 text-sm font-semibold text-fg hover:bg-line">
            ⚖ Compare
          </Link>
        </div>

        {/* record */}
        <div className="mt-6 grid grid-cols-5 gap-3 rounded-2xl border border-line bg-white p-5 text-center shadow-sm">
          <Rec label="Played" value={stats.p} />
          <Rec label="Won" value={stats.w} accent="text-success" />
          <Rec label="Drawn" value={stats.d} />
          <Rec label="Lost" value={stats.l} accent="text-danger" />
          <Rec label="Goals" value={`${stats.gf}–${stats.ga}`} accent="text-brand" />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="text-lg font-bold text-fg">Squad ({stats.members.length})</h2>
            {stats.members.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No players registered yet.</p>
            ) : (
              <ul className="mt-3 space-y-1">
                {stats.members.map((m) => (
                  <li key={m.id}>
                    <Link href={`/players/${m.id}`} className="flex items-center gap-3 rounded-lg border border-line bg-white px-3 py-2 text-sm transition-colors hover:border-brand/40">
                      <span className="w-5 text-right text-xs font-bold text-subtle">{m.number}</span>
                      <span className="font-medium text-fg">{m.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="text-lg font-bold text-fg">Recent results</h2>
            {stats.recent.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No finished matches yet.</p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {stats.recent.map((r, i) => (
                  <li key={i}>
                    <Link href={`/match/${r.code}`} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm transition-colors hover:border-brand/40">
                      <span className="min-w-0 truncate font-medium text-fg">vs {r.opponent}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        {r.comp ? <span className="hidden text-xs text-subtle sm:inline">{r.comp}</span> : null}
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
      </div>
    </PublicShell>
  );
}

function Rec({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div>
      <p className={`text-2xl font-black tabular-nums ${accent ?? "text-fg"}`}>{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">{label}</p>
    </div>
  );
}

function ResultPill({ r }: { r: "W" | "D" | "L" }) {
  const cls = r === "W" ? "text-success" : r === "L" ? "text-danger" : "text-muted";
  return <span className={`rounded-md bg-surface px-1.5 py-0.5 text-xs font-black ${cls}`}>{r}</span>;
}
