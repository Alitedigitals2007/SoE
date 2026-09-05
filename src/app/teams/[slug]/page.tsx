import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { teamStats } from "@/lib/platform/engine";
import { PublicShell } from "@/components/site";
import { Badge } from "@/components/ui";
import { CsvDownloadButton } from "@/components/CsvDownloadButton";
import { exportTeamCsvAction } from "@/app/actions/exports";

export const dynamic = "force-dynamic";

export default async function TeamDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true, name: true, code: true } });
  if (!team) notFound();
  const stats = await teamStats(team.id);
  if (!stats) notFound();

  const winRate = stats.p > 0 ? ((stats.w / stats.p) * 100).toFixed(1) : "0.0";

  return (
    <PublicShell>
      <div className="mx-auto max-w-5xl px-4 py-10">
        {/* Broadcast header banner */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-fg/15 bg-bg-elevated p-6 shadow-[4px_4px_0_rgba(11,32,48,.08)]">
          <div className="absolute -right-16 -top-20 w-72 h-72 rounded-full bg-brand/10 blur-3xl" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              {stats.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={stats.imageUrl} alt={`${stats.name} crest`} className="size-16 shrink-0 rounded-xl border-2 border-fg/15 bg-white object-cover shadow-md" />
              ) : (
                <span className="grid size-16 shrink-0 place-items-center rounded-xl brand-gradient text-2xl font-black text-white shadow-md">
                  {stats.name.slice(0, 1)}
                </span>
              )}
              <div>
                <h1 className="font-display text-2xl font-black uppercase tracking-wider text-fg">{stats.name}</h1>
                <p className="mt-0.5 text-xs text-muted">
                  Code <Badge tone="neutral">{stats.code}</Badge> · {stats.p} matches played
                  {stats.captain ? (
                    <>
                      {" "}· <Badge tone="gold">Captain: {stats.captain.name}</Badge>
                    </>
                  ) : null}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CsvDownloadButton
                label="Export CSV"
                filename={`${stats.slug}-stats.csv`}
                action={exportTeamCsvAction.bind(null, team.id)}
              />
              <Link href="/compare" className="inline-flex h-10 items-center rounded-lg bg-surface px-4 text-sm font-semibold text-fg hover:bg-line">
                ⚖ Compare
              </Link>
            </div>
          </div>

          {/* Stat strips */}
          <div className="relative z-10 mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-surface/80 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Played</p>
              <p className="mt-0.5 text-xl font-black tabular-nums text-fg">{stats.p}</p>
            </div>
            <div className="rounded-lg bg-surface/80 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Win Rate</p>
              <p className="mt-0.5 text-xl font-black tabular-nums text-success">{winRate}%</p>
            </div>
            <div className="rounded-lg bg-surface/80 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Goal Diff</p>
              <p className="mt-0.5 text-xl font-black tabular-nums text-brand">{stats.gf}–{stats.ga}</p>
            </div>
            <div className="rounded-lg bg-surface/80 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Record</p>
              <p className="mt-0.5 text-xl font-black tabular-nums text-fg">{stats.w}W {stats.d}D {stats.l}L</p>
            </div>
          </div>
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
                    <Link href={`/players/${m.id}`} className="flex items-center gap-3 rounded-xl border border-fg/15 bg-bg-elevated px-3 py-2.5 text-sm transition-colors hover:border-brand/40 hover:bg-bg-raised">
                      <span className="w-5 text-right text-xs font-bold text-subtle">{m.number}</span>
                      <span className="font-medium text-fg">{m.name}</span>
                      {m.isCaptain ? <span className="ml-auto shrink-0 text-xs text-gold" aria-label="captain">C</span> : null}
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
                    <Link href={`/match/${r.code}`} className="flex items-center justify-between gap-2 rounded-xl border border-fg/15 bg-bg-elevated px-3 py-2.5 text-sm transition-colors hover:border-brand/40 hover:bg-bg-raised">
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

function ResultPill({ r }: { r: "W" | "D" | "L" }) {
  const cls = r === "W" ? "text-success" : r === "L" ? "text-danger" : "text-muted";
  return <span className={`rounded-md bg-surface px-1.5 py-0.5 text-xs font-black ${cls}`}>{r}</span>;
}
