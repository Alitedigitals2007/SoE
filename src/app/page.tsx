import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SiteFooter, SiteHeader } from "@/components/site";
import { Badge } from "@/components/ui";
import { KickoffCountdown } from "@/components/KickoffCountdown";

export const dynamic = "force-dynamic";

/** 3D Pitch visualization for hero — pure CSS, no canvas. */
function Pitch3D() {
  return (
    <div
      aria-hidden
      className="relative aspect-square max-w-[500px] mx-auto"
      style={{ perspective: "1000px" }}
    >
      {/* Pitch surface */}
      <div className="soe-pitch-3d relative w-full aspect-square">
        {/* Grass texture */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-700 via-green-800 to-green-900 rounded-[1.5rem]" />
        {/* Center circle */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-20 border-2 border-white/30 rounded-full" />
        {/* Center spot */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-1.5 bg-white/60 rounded-full" />
        {/* Halfway line */}
        <div className="absolute left-1/2 top-0 h-full border-l border-white/20" />
        {/* Penalty areas */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-16 h-3/5 border-2 border-white/30 border-l-0 rounded-r-lg" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-16 h-3/5 border-2 border-white/30 border-r-0 rounded-l-lg" />
        {/* Goal areas */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-2/5 border-2 border-white/30 border-l-0 rounded-r-md" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-2/5 border-2 border-white/30 border-r-0 rounded-l-md" />
        {/* Penalty spots */}
        <div className="absolute left-6 top-1/2 -translate-y-1/2 size-1 bg-white/60 rounded-full" />
        <div className="absolute right-6 top-1/2 -translate-y-1/2 size-1 bg-white/60 rounded-full" />
        {/* Corner arcs */}
        <div className="absolute left-0 top-0 w-6 h-6 border-b-2 border-r-2 border-white/30 rounded-br-[3rem]" />
        <div className="absolute right-0 top-0 w-6 h-6 border-b-2 border-l-2 border-white/30 rounded-bl-[3rem]" />
        <div className="absolute left-0 bottom-0 w-6 h-6 border-t-2 border-r-2 border-white/30 rounded-tr-[3rem]" />
        <div className="absolute right-0 bottom-0 w-6 h-6 border-t-2 border-l-2 border-white/30 rounded-tl-[3rem]" />
      </div>
      {/* Floating ball */}
      <div className="soe-floating-ball absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl drop-shadow-[0_15px_30px_rgba(11,32,48,.5)] animate-float">
        ⚽
      </div>
      {/* Ambient particles */}
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="soe-ambient-particle absolute rounded-full bg-gold/40"
          style={{
            left: `${5 + (i * 7) % 90}%`,
            top: `${10 + (i * 11) % 80}%`,
            width: `${3 + (i % 3)}px`,
            height: `${3 + (i % 3)}px`,
            animationDelay: `${(i * 0.7) % 4}s`,
          }}
        />
      ))}
    </div>
  );
}

/** 3D stat counter with flip-in animation. */
function Stat3D({ value, label, icon, delay = 0 }: { value: number; label: string; icon: string; delay?: number }) {
  return (
    <div className="animate-soe-flip-in relative text-center" style={{ animationDelay: `${delay}s` }}>
      <div className="mb-2 text-3xl opacity-80">{icon}</div>
      <p className="text-4xl sm:text-5xl font-black tabular-nums text-brand tracking-tight">{value.toLocaleString()}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}

/** Live match card with 3D hover. */
function LiveMatchCard({ m }: { m: { id: string; code: string; homeName: string; awayName: string; homeScore: number; awayScore: number } }) {
  return (
    <Link
      href={`/match/${m.code}`}
      className="group relative overflow-hidden rounded-2xl border-2 border-fg/15 bg-bg-elevated p-5 shadow-[4px_4px_0_rgba(11,32,48,.08)] transition-all duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-[10px_10px_0_rgba(11,32,48,.15)]"
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-brand/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="relative flex items-center justify-between text-sm font-bold">
        <span className="flex-1 truncate text-fg group-hover:text-brand transition-colors">{m.homeName}</span>
        <span className="mx-3 rounded-lg bg-surface px-3 py-1 font-black tabular-nums text-fg group-hover:text-brand transition-colors">
          {m.homeScore} – {m.awayScore}
        </span>
        <span className="flex-1 truncate text-right text-fg group-hover:text-brand transition-colors">{m.awayName}</span>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
        <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-danger" /> Live · code {m.code}
      </p>
    </Link>
  );
}

/** Upcoming fixture row with 3D depth. */
function UpcomingRow({ m }: { m: { id: string; code: string; homeName: string; awayName: string; status: string; scheduledAt: Date | null } }) {
  return (
    <Link
      href={`/match/${m.code}`}
      className="group relative overflow-hidden rounded-xl border-2 border-fg/15 bg-bg-elevated px-4 py-3 shadow-[3px_3px_0_rgba(11,32,48,.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-[6px_6px_0_rgba(11,32,48,.12)]"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-gold/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <span className="relative flex min-w-0 flex-1 items-center justify-between gap-2 text-sm font-semibold text-fg">
        <span className="truncate group-hover:text-brand transition-colors">{m.homeName}</span>
        <span className="text-xs text-subtle">vs</span>
        <span className="truncate group-hover:text-brand transition-colors">{m.awayName}</span>
      </span>
      <span className="relative flex items-center gap-3">
        {m.scheduledAt ? <KickoffCountdown scheduledAt={m.scheduledAt.toISOString()} label="" /> : null}
        <Badge tone={m.status === "LIVE" ? "success" : "neutral"}>{m.status === "LIVE" ? "Live" : "Scheduled"}</Badge>
      </span>
    </Link>
  );
}

/** Competition card with 3D flip hover. */
function CompetitionCard({ c }: { c: { id: string; slug: string; name: string; type: string; status: string; _count: { teams: number; matches: number } } }) {
  const cup = c.type === "CUP";
  return (
    <Link
      href={`/competition/${c.slug}`}
      className="group relative overflow-hidden rounded-2xl border-2 border-fg/15 bg-bg-elevated p-5 shadow-[4px_4px_0_rgba(11,32,48,.08)] transition-all duration-500 hover:-translate-y-1 hover:border-brand/40 hover:shadow-[12px_12px_0_rgba(11,32,48,.15)] transform-style-3d"
      style={{ transformStyle: "preserve-3d" }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-gold/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative flex items-start justify-between gap-2">
        <p className="relative text-lg font-extrabold tracking-tight text-fg group-hover:text-brand transition-colors">{c.name}</p>
        <span aria-hidden className="relative text-3xl transform-gpu transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110">{cup ? "🏆" : "📊"}</span>
      </div>
      <div className="relative mt-3 flex items-center gap-2">
        <Badge tone={cup ? "info" : "pitch"}>{cup ? "Knockout cup" : "League"}</Badge>
        <Badge tone={c.status === "FINISHED" ? "neutral" : c.status === "ACTIVE" ? "success" : "warning"}>
          {c.status === "FINISHED" ? "Closed" : c.status === "ACTIVE" ? "Live" : "Setup"}
        </Badge>
      </div>
      <p className="relative mt-3 text-xs text-muted">{c._count.teams} teams · {c._count.matches} fixtures</p>
    </Link>
  );
}

/** Top scorer card with 3D depth. */
function ScorerCard({ s, rank }: { s: { id: string; name: string; goals: number }; rank: number }) {
  return (
    <Link
      href={`/players/${s.id}`}
      className="group relative overflow-hidden rounded-xl border-2 border-fg/15 bg-bg-elevated p-4 shadow-[3px_3px_0_rgba(11,32,48,.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-[8px_8px_0_rgba(11,32,48,.12)]"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-surface text-sm font-black text-brand group-hover:bg-brand group-hover:text-gold-ink transition-all duration-300">
        {rank}
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="block truncate font-semibold text-fg group-hover:text-brand transition-colors">{s.name}</span>
        <span className="text-xs text-muted">{s.goals} goal{s.goals === 1 ? "" : "s"}</span>
      </span>
      <span aria-hidden className="relative text-3xl transform-gpu transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110">⚽</span>
    </Link>
  );
}

function SectionHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-fg">{title}</h2>
        <p className="text-sm text-muted">{subtitle}</p>
      </div>
      {action ? (
        <Link href={action.href} className="text-sm font-semibold text-brand underline-offset-2 hover:underline">
          {action.label} →
        </Link>
      ) : null}
    </div>
  );
}

function EmptyCard({ text, action, icon }: { text: string; action?: React.ReactNode; icon?: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-fg/20 bg-bg-elevated p-10 text-center">
      {icon ? <p className="text-5xl mb-2 animate-float" aria-hidden>{icon}</p> : null}
      <p className="text-sm text-muted">{text}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export default async function Home() {
  const [players, teams, matches, live, upcoming, competitions, scorers] = await Promise.all([
    prisma.user.count({ where: { role: "PLAYER" } }),
    prisma.team.count(),
    prisma.match.count(),
    prisma.match.findMany({
      where: { status: "LIVE" },
      orderBy: { startedAt: "asc" },
      take: 6,
    }),
    prisma.match.findMany({
      where: { status: "DRAFT", scheduledAt: { not: null } },
      orderBy: { scheduledAt: "asc" },
      take: 8,
      select: { id: true, code: true, homeName: true, awayName: true, status: true, scheduledAt: true },
    }),
    prisma.competition.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { teams: true, matches: true } } },
    }),
    prisma.round.findMany({
      where: { decision: "GOAL", goalSubmission: { isNot: null }, match: { status: "FINISHED", competitionId: { not: null } } },
      include: { goalSubmission: { include: { player: { include: { user: { select: { id: true, name: true } } } } } } },
      take: 400,
    }),
  ]);

  const scorerMap = new Map<string, { name: string; id: string; goals: number }>();
  for (const r of scorers) {
    const p = r.goalSubmission?.player.user;
    if (!p) continue;
    const cur = scorerMap.get(p.id);
    if (cur) cur.goals += 1;
    else scorerMap.set(p.id, { name: p.name, id: p.id, goals: 1 });
  }
  const topScorers = [...scorerMap.values()].sort((a, b) => b.goals - a.goals).slice(0, 6);

  const liveMatches = live;
  const heroMatch = liveMatches[0] ?? upcoming.find((u) => u.scheduledAt) ?? null;
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        {/* HERO */}
        <section className="relative overflow-hidden border-b-2 border-fg bg-gradient-to-b from-brand/10 via-bg to-bg">
          {/* Animated background pattern */}
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23087a55\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
          <div className="absolute inset-0 opacity-10" style={{ background: 'radial-gradient(ellipse at 50% 0%, var(--brand) 0%, transparent 70%)' }} />

          <div className="scoreboard-strip flex items-center justify-center gap-8 py-2">
            <span>THE QUIZ LEAGUE</span><span className="text-gold">● MATCHDAY 01</span><span>ANSWER. SCORE. ADVANCE.</span>
          </div>
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 lg:grid-cols-2 lg:py-28">
            <div className="animate-fade-up">
              <Badge tone="pitch" className="mb-4 animate-pulse-brand">
                <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-brand" /> Live quiz football
              </Badge>
              <h1 className="font-display text-5xl sm:text-7xl font-black uppercase leading-[.92] tracking-[-.04em] text-fg">
                Every correct answer<br />
                is a <span className="text-gradient-brand">goal</span>.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-muted">
                Real matches, refereed live: 8-a-side teams battle through ten questions. Climb the league,
                win the knockout cup and pick your fantasy scorers.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/register"
                  className="animate-pulse-brand inline-flex h-12 items-center gap-2 rounded-xl brand-gradient px-6 text-base font-semibold text-white shadow-md transition-all hover:brightness-105 hover:scale-[1.02]"
                >
                  Start playing free
                </Link>
                {liveMatches.length > 0 ? (
                  <Link
                    href="/live"
                    className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-5 text-base font-semibold text-fg shadow-sm ring-1 ring-line transition-all hover:bg-surface hover:scale-[1.02]"
                  >
                    <span aria-hidden className="size-2.5 animate-pulse rounded-full bg-danger" />
                    Watch live
                  </Link>
                ) : null}
                <Link
                  href="/competitions"
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-5 text-base font-semibold text-fg shadow-sm ring-1 ring-line transition-all hover:bg-surface hover:scale-[1.02]"
                >
                  Browse leagues
                </Link>
              </div>
            </div>

            {/* Hero board — 3D pitch with live match data */}
            <div className="animate-pop relative">
              {heroMatch ? (
                <div className="relative overflow-hidden rounded-[2rem] border-2 border-fg shadow-[15px_15px_0_rgba(11,32,48,.25)]">
                  {/* 3D Pitch background */}
                  <div className="absolute inset-0 opacity-15">
                    <Pitch3D />
                  </div>
                  <div className="relative z-10 p-6 sm:p-8">
                    <div className="scoreboard-strip flex items-center justify-between px-4 py-1.5 rounded-t-[1.5rem]">
                      <span className="text-[10px] font-black uppercase tracking-[0.25em]">Matchday board</span>
                      {heroMatch.status === "LIVE" ? (
                        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gold">
                          <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-danger" /> Live
                        </span>
                      ) : (
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/70">Up next</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 flex-1 truncate text-left text-lg sm:text-xl font-extrabold uppercase tracking-wide text-white">
                        {heroMatch.homeName}
                      </p>
                      <div className="shrink-0 text-center">
                        {heroMatch.status === "LIVE" ? (
                          <p className="text-5xl sm:text-6xl font-black tabular-nums text-white">
                            {heroMatch.homeScore}
                            <span className="text-white/40"> – </span>
                            {heroMatch.awayScore}
                          </p>
                        ) : (
                          <span className="font-display text-3xl font-black text-white/70">vs</span>
                        )}
                      </div>
                      <p className="min-w-0 flex-1 truncate text-right text-lg sm:text-xl font-extrabold uppercase tracking-wide text-white">
                        {heroMatch.awayName}
                      </p>
                    </div>
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/90">
                      {heroMatch.status === "LIVE" ? (
                        <span className="flex items-center gap-2 font-semibold uppercase tracking-wider">
                          <span aria-hidden className="size-2 animate-pulse rounded-full bg-danger" /> Watch it live
                        </span>
                      ) : heroMatch.scheduledAt ? (
                        <KickoffCountdown scheduledAt={heroMatch.scheduledAt.toISOString()} />
                      ) : (
                        <span className="font-semibold uppercase tracking-wider">Kick-off TBA</span>
                      )}
                    </div>
                    <div className="mt-6 text-center">
                      <Link
                        href={heroMatch.status === "LIVE" ? `/watch/${heroMatch.code}` : `/match/${heroMatch.code}`}
                        className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-6 text-sm font-black uppercase tracking-wider text-brand-deep shadow-md transition-all hover:scale-[1.03] hover:shadow-lg"
                      >
                        {heroMatch.status === "LIVE" ? "Watch free" : "View match"} →
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative overflow-hidden rounded-[2rem] border-2 border-fg shadow-[15px_15px_0_rgba(11,32,48,.25)]">
                  <div className="absolute inset-0 opacity-15">
                    <Pitch3D />
                  </div>
                  <div className="relative z-10 flex min-h-64 flex-col items-center justify-center rounded-[2rem] p-8 text-center">
                    <span className="text-6xl animate-float" aria-hidden>🏟️</span>
                    <p className="mt-3 text-lg font-black uppercase tracking-wide text-white">No matches yet</p>
                    <p className="mt-1 max-w-xs text-sm text-white/80">Create a friendly or competition to start the first matchday.</p>
                    <Link
                      href="/admin/matches/new"
                      className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-6 text-sm font-black uppercase tracking-wider text-brand-deep shadow-md transition-all hover:scale-[1.03] hover:shadow-lg"
                    >
                      Set up a match →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* STATS — 3D animated counters */}
        <section className="relative border-b-2 border-fg bg-gradient-to-b from-bg to-bg-elevated/50">
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' viewBox=\'0 0 40 40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23087a55\' fill-opacity=\'0.3\'%3E%3Cpath d=\'M20 0h2v20H20V0zm20 0h2v20h-2V0z\'/%3E%3C/g%3E%3C/svg%3E")' }} />
          <div className="relative mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-10 sm:grid-cols-4">
            <Stat3D value={players} label="Registered players" icon="👥" delay={0} />
            <Stat3D value={teams} label="Teams" icon="🏟️" delay={0.08} />
            <Stat3D value={competitions.length} label="Competitions" icon="🏆" delay={0.16} />
            <Stat3D value={matches} label="Matches played" icon="⚽" delay={0.24} />
          </div>
        </section>

        {/* LIVE NOW */}
        <section className="mx-auto max-w-7xl px-4 py-14">
          <SectionHead
            title="Live now"
            subtitle="Matches currently on the pitch"
            action={liveMatches.length ? { href: "/live", label: "All live matches" } : undefined}
          />
          {liveMatches.length === 0 ? (
            <EmptyCard icon="📡" text="No live matches right now — check back soon or start one from your dashboard." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {liveMatches.map((m) => (
                <LiveMatchCard key={m.id} m={m} />
              ))}
            </div>
          )}
        </section>

        {/* UPCOMING */}
        <section className="mx-auto max-w-7xl px-4 pb-14">
          <SectionHead title="Scheduled" subtitle="Next fixtures to watch" action={{ href: "/fixtures", label: "All fixtures" }} />
          {upcoming.length === 0 ? (
            <EmptyCard icon="🗓️" text="Fixtures will appear here once leagues and cups are set up." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {upcoming.slice(0, 6).map((m) => (
                <UpcomingRow key={m.id} m={m} />
              ))}
            </div>
          )}
        </section>

        {/* COMPETITIONS */}
        <section className="border-y-2 border-fg/15 bg-bg-elevated/70">
          <div className="mx-auto max-w-7xl px-4 py-14">
            <SectionHead
              title="Leagues & knockout cups"
              subtitle="Round-robin tables and single-elimination brackets"
              action={{ href: "/competitions", label: "Browse all" }}
            />
            {competitions.length === 0 ? (
              <EmptyCard
                icon="🏆"
                text="No competitions yet."
                action={
                  isAdmin ? (
                    <Link href="/admin/competitions/new" className="font-semibold text-brand underline-offset-2 hover:underline">
                      Create the first competition →
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {competitions.map((c) => (
                  <CompetitionCard key={c.id} c={c} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* TOP SCORERS */}
        {topScorers.length > 0 ? (
          <section className="mx-auto max-w-7xl px-4 py-14">
            <SectionHead title="Golden boot" subtitle="Most goals in competitive matches (friendlies excluded)" action={{ href: "/players", label: "All players" }} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {topScorers.map((s, i) => (
                <ScorerCard key={s.id} s={s} rank={i + 1} />
              ))}
            </div>
          </section>
        ) : null}

        {/* HOW IT WORKS */}
        <section className="border-t-2 border-fg pitch-bg relative overflow-hidden">
          <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(ellipse at center, var(--brand) 0%, transparent 70%)' }} />
          <div className="relative mx-auto max-w-7xl px-4 py-16">
            <div className="mb-10 text-center">
              <p className="text-[10px] font-black uppercase tracking-[.3em] text-white/60 mb-2">HOW IT WORKS</p>
              <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white">Three steps to glory</h2>
            </div>
            <div className="grid gap-6 text-center md:grid-cols-3">
              {[
                { n: "01", t: "Follow the game", d: "Register as a fan, explore teams and build your fantasy entry.", icon: "📋" },
                { n: "02", t: "Win the match", d: "Ten questions, one referee. Answer fast — accepted answers are goals.", icon: "⚽" },
                { n: "03", t: "Claim the trophy", d: "Win the league table or cut through the knockout bracket, and lift the trophy.", icon: "🏆" },
              ].map((step) => (
                <div key={step.n} className="relative rounded-2xl bg-white/10 p-6 backdrop-blur-sm border border-white/10 hover:border-brand/30 hover:bg-white/15 transition-all duration-300 group">
                  <p className="text-3xl font-black text-white/30 group-hover:text-brand/50 transition-colors">{step.n}</p>
                  <span className="relative inline-block text-4xl mb-2 animate-float" aria-hidden>{step.icon}</span>
                  <h3 className="mt-2 text-lg font-bold text-white">{step.t}</h3>
                  <p className="mt-1 text-sm text-white/80">{step.d}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 text-center">
              <Link
                href="/register"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-7 text-base font-bold text-brand-deep shadow-lg transition-all hover:scale-[1.03] hover:shadow-xl"
              >
                Register & build your fantasy squad
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}