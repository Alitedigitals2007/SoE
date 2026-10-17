import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { playerStats } from "@/lib/platform/engine";
import { getPlayerStats } from "@/lib/stats/player";
import { PublicShell } from "@/components/site";
import { Avatar } from "@/components/Avatar";
import { PlayerGameCard } from "@/components/PlayerGameCard";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PlayerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, imageUrl: true, role: true, marketValue: true, teams: { include: { team: { select: { name: true, slug: true } } } } },
  });
  if (!user || user.role !== "PLAYER") notFound();
  const stats = await playerStats(id);
  if (!stats) notFound();
  const full = await getPlayerStats(id);

  return (
    <PublicShell>
      <div className="mx-auto max-w-5xl px-4 py-10">
        {/* Broadcast header banner */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-fg/15 bg-bg-elevated p-6 shadow-[4px_4px_0_rgba(11,32,48,.08)]">
          <div className="absolute -right-16 -top-20 w-72 h-72 rounded-full bg-brand/10 blur-3xl" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar name={user.name} src={user.imageUrl} size={64} className="rounded-xl" />
              <div>
                <h1 className="font-display text-2xl font-black uppercase tracking-wider text-fg">{user.name}</h1>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Badge tone="pitch">Player</Badge>
                  {user.teams.map((t) => (
                    <Badge key={t.team.slug} tone="info">
                      {t.team.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <Link href="/compare" className="inline-flex h-10 items-center rounded-lg bg-surface px-4 text-sm font-semibold text-fg hover:bg-line">
              ⚖ Compare
            </Link>
          </div>
        </div>

        {/* 3D flip game card + contribution panel */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <PlayerGameCard
            name={user.name}
            imageUrl={user.imageUrl}
            teams={user.teams.map((t) => ({ name: t.team.name, slug: t.team.slug }))}
            matches={stats.matches}
            wins={stats.wins}
            stats={full}
          />

          <section className="rounded-2xl border-2 border-fg/15 bg-bg-elevated p-5">
            <h2 className="text-sm font-black uppercase tracking-wider text-fg">Contribution to the side</h2>
            <p className="mt-1 text-xs text-muted">
              Share of everything the sides produced across {full.matches} finished match
              {full.matches === 1 ? "" : "es"}.
            </p>

            <div className="mt-4 space-y-4">
              <ContributionBar
                label="Goals"
                value={full.goals}
                share={full.goalShare}
                total={full.teamGoals}
                tone="bg-brand"
              />
              <ContributionBar
                label="Assists"
                value={full.assists}
                share={full.assistShare}
                total={full.teamAssists}
                tone="bg-gold-strong"
              />
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              {[
                { label: "MOTM awards", value: full.motm, tone: "text-gold-strong" },
                { label: "Yellow cards", value: full.yellowCards, tone: "text-warning" },
                { label: "Red cards", value: full.redCards, tone: "text-danger" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-line bg-white p-3">
                  <p className={`text-xl font-black tabular-nums ${s.tone}`}>{s.value}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{s.label}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-bold text-fg">Recent results</h2>
          {stats.recent.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No finished matches yet.</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {stats.recent.map((r, i) => (
                <li key={i}>
                  <Link href={`/match/${r.code}`} className="flex items-center justify-between gap-2 rounded-xl border border-fg/15 bg-bg-elevated px-4 py-2.5 text-sm transition-colors hover:border-brand/40 hover:bg-bg-raised">
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

function ContributionBar({
  label,
  value,
  share,
  total,
  tone,
}: {
  label: string;
  value: number;
  share: number | null;
  total: number;
  tone: string;
}) {
  const width = share ?? 0;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-bold text-fg">
          {label} <span className="font-black tabular-nums text-brand">{value}</span>
        </p>
        <p className="text-xs font-semibold text-muted">
          {share !== null ? `${share}% of ${total}` : total > 0 ? "None yet" : "No output yet"}
        </p>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-surface" role="presentation">
        <div className={`h-full rounded-full ${tone} transition-all`} style={{ width: `${Math.min(100, width)}%` }} />
      </div>
    </div>
  );
}

function ResultPill({ r }: { r: "W" | "D" | "L" }) {
  const cls = r === "W" ? "text-success" : r === "L" ? "text-danger" : "text-muted";
  return <span className={`rounded-md bg-surface px-1.5 py-0.5 text-xs font-black ${cls}`}>{r}</span>;
}
