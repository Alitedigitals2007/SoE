import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SiteFooter, SiteHeader } from "@/components/site";
import { Badge } from "@/components/ui";
import { KickoffCountdown } from "@/components/KickoffCountdown";

export const dynamic = "force-dynamic";

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
      where: { status: "DRAFT" },
      orderBy: { createdAt: "asc" },
      take: 8,
      select: { id: true, code: true, homeName: true, awayName: true, status: true, scheduledAt: true },
    }),
    prisma.competition.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { teams: true, matches: true } } },
    }),
    prisma.round.findMany({
      where: { decision: "GOAL", goalSubmission: { isNot: null }, match: { status: "FINISHED" } },
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
        <section className="stadium-glow broadcast-grid relative overflow-hidden border-b-2 border-fg">
          <div className="scoreboard-strip flex items-center justify-center gap-8 py-2">
            <span>THE QUIZ LEAGUE</span><span className="text-gold">● MATCHDAY 01</span><span>ANSWER. SCORE. ADVANCE.</span>
          </div>
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 lg:grid-cols-2 lg:py-24">
            <div className="animate-fade-up">
              <Badge tone="pitch" className="mb-4">
                <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-brand" /> Live quiz football
              </Badge>
              <h1 className="font-display text-5xl font-black uppercase leading-[.92] tracking-[-.04em] text-fg sm:text-7xl">
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
                  className="animate-pulse-brand inline-flex h-12 items-center gap-2 rounded-xl brand-gradient px-6 text-base font-semibold text-white shadow-md transition-transform hover:brightness-105"
                >
                  Start playing free
                </Link>
                {liveMatches.length > 0 ? (
                  <Link
                    href="/live"
                    className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-5 text-base font-semibold text-fg shadow-sm ring-1 ring-line transition-colors hover:bg-surface"
                  >
                    <span aria-hidden className="size-2.5 animate-pulse rounded-full bg-danger" />
                    Watch live
                  </Link>
                ) : null}
                <Link
                  href="/competitions"
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-5 text-base font-semibold text-fg shadow-sm ring-1 ring-line transition-colors hover:bg-surface"
                >
                  Browse leagues
                </Link>
              </div>
            </div>

            {/* Hero board — real data: live match or next scheduled kick-off */}
            <div className="animate-pop">
              {heroMatch ? (
                <div className="pitch-bg overflow-hidden rounded-[2rem] border-2 border-fg shadow-[10px_10px_0_rgba(11,32,48,.22)]">
                  <div className="scoreboard-strip flex items-center justify-between px-4 py-1.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.25em]">Matchday board</span>
                    {heroMatch.status === "LIVE" ? (
                      <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gold">
                        <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-danger" /> Live
                      </span>
                    ) : (
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/70">Up next</span>
                    )}
                  </div>
                  <div className="p-6 sm:p-8">
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 flex-1 truncate text-left text-lg font-extrabold uppercase tracking-wide text-white">
                        {heroMatch.homeName}
                      </p>
                      <div className="shrink-0 text-center">
                        {heroMatch.status === "LIVE" ? (
                          <p className="text-5xl font-black tabular-nums text-white sm:text-6xl">
                            {heroMatch.homeScore}
                            <span className="text-white/40"> – </span>
                            {heroMatch.awayScore}
                          </p>
                        ) : (
                          <span className="font-display text-3xl font-black text-white/70">vs</span>
                        )}
                      </div>
                      <p className="min-w-0 flex-1 truncate text-right text-lg font-extrabold uppercase tracking-wide text-white">
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
                        className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-6 text-sm font-black uppercase tracking-wider text-brand-deep shadow-md transition-transform hover:scale-[1.03]"
                      >
                        {heroMatch.status === "LIVE" ? "Watch free" : "View match"} →
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="pitch-bg flex min-h-64 flex-col items-center justify-center rounded-[2rem] border-2 border-fg p-8 text-center shadow-[10px_10px_0_rgba(11,32,48,.22)]">
                  <span className="text-5xl" aria-hidden>🏟️</span>
                  <p className="mt-3 text-lg font-black uppercase tracking-wide text-white">No matches yet</p>
                  <p className="mt-1 max-w-xs text-sm text-white/80">Create a friendly or competition to start the first matchday.</p>
                  <Link
                    href="/admin/matches/new"
                    className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-6 text-sm font-black uppercase tracking-wider text-brand-deep shadow-md transition-transform hover:scale-[1.03]"
                  >
                    Set up a match →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* STATS */}
        <section className="scoreboard-strip border-b-0">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-8 sm:grid-cols-4">
            <Stat value={players} label="Registered players" />
            <Stat value={teams} label="Teams" />
            <Stat value={competitions.length} label="Competitions" />
            <Stat value={matches} label="Matches played" />
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
                <MatchCard key={m.id} m={m} live />
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
            <div className="grid gap-3 md:grid-cols-2">
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
            <SectionHead title="Golden boot" subtitle="Most goals scored across all finished matches" action={{ href: "/players", label: "All players" }} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {topScorers.map((s, i) => (
                <Link
                  key={s.id}
                  href={`/players/${s.id}`}
                  className="flex items-center gap-3 rounded-xl border-2 border-fg/15 bg-bg-elevated p-4 shadow-[3px_3px_0_rgba(11,32,48,.06)] transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-sm font-black text-brand">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-fg">{s.name}</span>
                    <span className="text-xs text-muted">{s.goals} goals</span>
                  </span>
                  <span aria-hidden className="text-2xl">⚽</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* HOW IT WORKS */}
        <section className="border-t-2 border-fg pitch-bg">
          <div className="mx-auto max-w-7xl px-4 py-16">
            <div className="grid gap-6 text-center text-white md:grid-cols-3">
              {[
                 { n: "01", t: "Follow the game", d: "Register as a fan, explore teams and build your fantasy entry." },
                { n: "02", t: "Win the match", d: "Ten questions, one referee. Answer fast — accepted answers are goals." },
                { n: "03", t: "Claim the trophy", d: "Win the league table or cut through the knockout bracket, and score fantasy points." },
              ].map((s) => (
                <div key={s.n} className="rounded-2xl bg-white/10 p-6 backdrop-blur-sm">
                  <p className="text-3xl font-black text-white/30">{s.n}</p>
                  <h3 className="mt-2 text-lg font-bold">{s.t}</h3>
                  <p className="mt-1 text-sm text-white/80">{s.d}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 text-center">
              <Link
                href="/register"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-7 text-base font-bold text-brand-deep shadow-lg transition-transform hover:scale-[1.03]"
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

/* ------------------------------- small pieces ------------------------------ */

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <p className="text-3xl font-black tabular-nums text-brand">{value.toLocaleString()}</p>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
    </div>
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
        <h2 className="text-2xl font-black tracking-tight text-fg">{title}</h2>
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
      {icon ? <p className="text-4xl" aria-hidden>{icon}</p> : null}
      <p className="text-sm text-muted">{text}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

function MatchCard({ m, live }: { m: { id: string; code: string; homeName: string; awayName: string; homeScore: number; awayScore: number }; live?: boolean }) {
  return (
    <Link
      href={`/match/${m.code}`}
      className="group overflow-hidden rounded-2xl border-2 border-fg/15 bg-bg-elevated p-5 shadow-[4px_4px_0_rgba(11,32,48,.08)] transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
    >
      <div className="flex items-center justify-between text-sm font-bold">
        <span className="flex-1 truncate text-fg">{m.homeName}</span>
        <span className="mx-3 rounded-lg bg-surface px-2 py-0.5 font-black tabular-nums text-fg">
          {live ? `${m.homeScore} – ${m.awayScore}` : "vs"}
        </span>
        <span className="flex-1 truncate text-right text-fg">{m.awayName}</span>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
        {live ? (
          <>
            <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-danger" /> Live · code {m.code}
          </>
        ) : (
          <>Scheduled · code {m.code}</>
        )}
      </p>
    </Link>
  );
}

function UpcomingRow({ m }: { m: { id: string; code: string; homeName: string; awayName: string; status: string; scheduledAt: Date | null } }) {
  return (
    <Link
      href={`/match/${m.code}`}
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-fg/15 bg-bg-elevated px-4 py-3 shadow-[3px_3px_0_rgba(11,32,48,.06)] transition-colors hover:border-brand/40"
    >
      <span className="flex min-w-0 flex-1 items-center justify-between gap-2 text-sm font-semibold text-fg">
        <span className="truncate">{m.homeName}</span>
        <span className="text-xs text-subtle">vs</span>
        <span className="truncate">{m.awayName}</span>
      </span>
      <span className="flex items-center gap-3">
        {m.scheduledAt ? <KickoffCountdown scheduledAt={m.scheduledAt.toISOString()} label="" /> : null}
        <Badge tone={m.status === "LIVE" ? "success" : "neutral"}>{m.status === "LIVE" ? "Live" : "Scheduled"}</Badge>
      </span>
    </Link>
  );
}

function CompetitionCard({ c }: { c: { id: string; slug: string; name: string; type: string; status: string; _count: { teams: number; matches: number } } }) {
  const cup = c.type === "CUP";
  return (
    <Link
      href={`/competition/${c.slug}`}
      className="group rounded-2xl border-2 border-fg/15 bg-bg-elevated p-5 shadow-[4px_4px_0_rgba(11,32,48,.08)] transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-lg font-extrabold tracking-tight text-fg group-hover:text-brand">{c.name}</p>
        <span aria-hidden className="text-2xl">{cup ? "🏆" : "📊"}</span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Badge tone={cup ? "info" : "pitch"}>{cup ? "Knockout cup" : "League"}</Badge>
        <Badge tone={c.status === "FINISHED" ? "neutral" : c.status === "ACTIVE" ? "success" : "warning"}>
          {c.status === "FINISHED" ? "Closed" : c.status === "ACTIVE" ? "Live" : "Setup"}
        </Badge>
      </div>
      <p className="mt-3 text-xs text-muted">
        {c._count.teams} teams · {c._count.matches} fixtures
      </p>
    </Link>
  );
}
