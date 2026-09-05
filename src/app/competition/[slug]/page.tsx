import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { leagueStandings } from "@/lib/platform/engine";
import { PublicShell } from "@/components/site";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CompetitionDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const comp = await prisma.competition.findUnique({
    where: { slug },
    include: {
      teams: { include: { team: { select: { id: true, name: true, slug: true, code: true } } }, orderBy: { seed: "asc" } },
      matches: {
        include: {
          homeTeam: { select: { slug: true } },
          awayTeam: { select: { slug: true } },
          competition: true,
        },
        orderBy: [{ cupRound: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!comp) notFound();

  const cup = comp.type === "CUP";
  const rows = cup ? null : await leagueStandings(comp.id);

  const groupByRound = new Map<number, typeof comp.matches>();
  if (cup) {
    for (const m of comp.matches) {
      const r = m.cupRound ?? 0;
      if (!groupByRound.has(r)) groupByRound.set(r, []);
      groupByRound.get(r)!.push(m);
    }
  }
  const rounds = cup ? [...groupByRound.entries()].sort((a, b) => a[0] - b[0]) : [];

  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-black tracking-tight text-fg">{comp.name}</h1>
          <Badge tone={cup ? "info" : "pitch"}>{cup ? "Knockout cup" : "League"}</Badge>
          <Badge tone={comp.status === "FINISHED" ? "neutral" : comp.status === "ACTIVE" ? "success" : "warning"}>
            {comp.status === "FINISHED" ? "Finished" : comp.status === "ACTIVE" ? "Active" : "Setup"}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted">Season {comp.season} · {comp.teams.length} teams</p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {comp.status !== "FINISHED" && comp.matches.length > 0 ? (
            <Link href={`/fantasy/${comp.id}`} className="inline-flex h-10 items-center rounded-lg brand-gradient px-4 text-sm font-semibold text-white shadow-sm hover:brightness-105">
              ⭐ Pick your fantasy XI
            </Link>
          ) : null}
          <a href="#fixtures" className="text-sm font-semibold text-brand underline-offset-2 hover:underline">
            Jump to fixtures ↓
          </a>
        </div>

        {cup ? (
          <CupSection comp={comp} rounds={rounds} />
        ) : (
          rows && (
            <div className="mt-8 overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
              <div className="px-5 py-4">
                <h2 className="text-lg font-bold text-fg">Standings</h2>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="border-y border-line bg-bg-raised text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-2 font-semibold">#</th>
                    <th className="px-4 py-2 font-semibold">Team</th>
                    <th className="px-2 py-2 text-center font-semibold">P</th>
                    <th className="px-2 py-2 text-center font-semibold">W</th>
                    <th className="px-2 py-2 text-center font-semibold">D</th>
                    <th className="px-2 py-2 text-center font-semibold">L</th>
                    <th className="px-2 py-2 text-center font-semibold">GF</th>
                    <th className="px-2 py-2 text-center font-semibold">GA</th>
                    <th className="px-2 py-2 text-center font-semibold">GD</th>
                    <th className="px-4 py-2 text-center font-semibold">Pts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-10 text-center text-muted">
                        No finished matches yet — results fill the table as matches end.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r, i) => (
                      <tr key={r.id} className="hover:bg-bg-raised">
                        <td className="px-4 py-2.5 font-bold text-subtle">{i + 1}</td>
                        <td className="px-4 py-2.5">
                          <Link href={`/teams/${r.slug}`} className="font-semibold text-fg hover:text-brand">
                            {r.name}
                          </Link>
                        </td>
                        <td className="px-2 py-2.5 text-center text-muted">{r.p}</td>
                        <td className="px-2 py-2.5 text-center text-muted">{r.w}</td>
                        <td className="px-2 py-2.5 text-center text-muted">{r.d}</td>
                        <td className="px-2 py-2.5 text-center text-muted">{r.l}</td>
                        <td className="px-2 py-2.5 text-center text-muted">{r.gf}</td>
                        <td className="px-2 py-2.5 text-center text-muted">{r.ga}</td>
                        <td className="px-2 py-2.5 text-center font-semibold text-fg">{r.gf - r.ga}</td>
                        <td className="px-4 py-2.5 text-center text-base font-black text-brand">{r.pts}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Fixtures */}
        <div id="fixtures" className="mt-10">
          <h2 className="text-xl font-bold text-fg">
            {cup ? "Matches" : "Fixtures"} <span className="text-base font-medium text-muted">({comp.matches.length})</span>
          </h2>
          <div className="mt-3 grid gap-2">
            {comp.matches.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-muted">
                No fixtures scheduled yet.
              </p>
            ) : (
              comp.matches.map((m) => (
                <MatchRow
                  key={m.id}
                  code={m.code}
                  home={m.homeName}
                  away={m.awayName}
                  hs={m.homeScore}
                  as={m.awayScore}
                  status={m.status}
                  homeSlug={m.homeTeam?.slug}
                  awaySlug={m.awayTeam?.slug}
                  round={cup ? m.cupRound ?? undefined : undefined}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </PublicShell>
  );
}

function MatchRow({
  code,
  home,
  away,
  hs,
  as,
  status,
  homeSlug,
  awaySlug,
  round,
}: {
  code: string;
  home: string;
  away: string;
  hs: number;
  as: number;
  status: string;
  homeSlug?: string;
  awaySlug?: string;
  round?: number;
}) {
  const finished = status === "FINISHED";
  const live = status === "LIVE";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 shadow-sm transition-colors hover:border-brand/40">
      <div className="min-w-0 flex-1">
        {round ? <p className="text-[10px] font-bold uppercase tracking-widest text-subtle">Round {round}</p> : null}
        <p className="flex items-center justify-between gap-2 text-sm font-semibold text-fg">
          <span className="flex min-w-0 flex-1 justify-end truncate">
            {homeSlug ? <Link href={`/teams/${homeSlug}`} className="hover:text-brand">{home}</Link> : home}
          </span>
          <span className="mx-2 rounded-lg bg-surface px-2.5 py-1 font-black tabular-nums text-fg">
            {finished || live ? `${hs} – ${as}` : "vs"}
          </span>
          <span className="flex min-w-0 flex-1 truncate">
            {awaySlug ? <Link href={`/teams/${awaySlug}`} className="hover:text-brand">{away}</Link> : away}
          </span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge tone={finished ? "neutral" : live ? "success" : "warning"}>{finished ? "FT" : live ? "Live" : "Scheduled"}</Badge>
        <Link href={`/match/${code}`} className="rounded-lg bg-surface px-3 py-1.5 text-xs font-semibold text-fg hover:bg-line">
          Open
        </Link>
      </div>
    </div>
  );
}

function CupSection({
  comp,
  rounds,
}: {
  comp: { id: string; name: string; teams: { team: { name: string; slug: string; code: string } }[] };
  rounds: [number, { id: string; code: string; homeName: string; awayName: string; homeScore: number; awayScore: number; status: string }[]][];
}) {
  const finalIdx = rounds.length - 1;
  return (
    <div className="mt-8 rounded-2xl border border-line bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-fg">Bracket</h2>
      <div className="mt-4 grid gap-6 md:grid-cols-3 lg:grid-cols-4">
        {rounds.map(([round, matches], idx) => {
          const isFinal = idx === finalIdx;
          return (
            <div key={round} className="min-w-0">
              <p className="mb-2 text-xs font-black uppercase tracking-widest text-brand">
                {isFinal ? "🏆 Final" : `Round ${round}${idx === 0 ? " · First" : ""}`}
              </p>
              <div className="space-y-2">
                {matches.map((m) => (
                  <a key={m.id} href={`/match/${m.code}`} className="block rounded-lg border border-line bg-bg-raised p-2.5 text-xs transition-colors hover:border-brand/40">
                    <p className="flex items-center justify-between gap-1 font-semibold text-fg">
                      <span className="truncate">{m.homeName}</span>
                      <span className="shrink-0 tabular-nums">
                        {m.status === "FINISHED" ? `${m.homeScore}–${m.awayScore}` : "v"}
                      </span>
                    </p>
                    <p className="mt-0.5 flex items-center justify-between gap-1 font-semibold text-fg">
                      <span className="truncate">{m.awayName}</span>
                      {m.status === "LIVE" ? <span aria-hidden className="size-1.5 shrink-0 animate-pulse rounded-full bg-danger" /> : null}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          );
        })}
        {rounds.length === 0 ? (
          <p className="text-sm text-muted">The bracket will appear here when the first round is generated.</p>
        ) : null}
      </div>
      <div className="mt-6 border-t border-line pt-4">
        <p className="text-xs text-muted">
          Entrants: {comp.teams.map((t) => t.team.name).join(", ")}
        </p>
      </div>
    </div>
  );
}
