import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { homePath } from "@/lib/authz";
import { fantasyBoard } from "@/lib/platform/engine";
import { PublicShell } from "@/components/site";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function FanDashboard() {
  const session = await auth();
  const user = session?.user ?? null;
  if (!user) redirect("/login");
  if (user.role !== "USER") redirect(homePath(user.role));

  const [liveCount, comps] = await Promise.all([
    prisma.match.count({ where: { status: "LIVE" } }),
    prisma.competition.findMany({
      where: { status: { not: "FINISHED" } },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { teams: true, fantasyEntries: true } } },
    }),
  ]);

  const entries = await Promise.all(
    comps.map(async (c) => {
      const board = await fantasyBoard(c.id);
      const mine = board.find((e) => e.userId === user.id) ?? null;
      return {
        id: c.id,
        name: c.name,
        season: c.season,
        type: c.type,
        status: c.status,
        teams: c._count.teams,
        totalEntries: c._count.fantasyEntries,
        entry: mine
          ? { id: mine.id, name: mine.name, points: mine.points, picks: mine._count.picks, rank: board.indexOf(mine) + 1 }
          : null,
      };
    }),
  );

  const myEntries = entries.filter((e) => e.entry);
  const points = myEntries.reduce((sum, e) => sum + (e.entry?.points ?? 0), 0);

  return (
    <PublicShell>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-fg">Welcome back, {user.name.split(" ")[0]}</h1>
            <p className="mt-1 text-muted">Your fan hub — fantasy entries, live action and fixtures.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/live" className="inline-flex h-10 items-center rounded-lg bg-surface px-4 text-sm font-semibold text-fg hover:bg-line">
              {liveCount > 0 ? <span className="mr-2 size-2 animate-pulse rounded-full bg-danger" /> : null}
              {liveCount > 0 ? `${liveCount} live` : "Live"}
            </Link>
            <Link href="/fixtures" className="inline-flex h-10 items-center rounded-lg bg-surface px-4 text-sm font-semibold text-fg hover:bg-line">
              Fixtures
            </Link>
          </div>
        </div>

        {/* Topline stats */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Fantasy entries" value={myEntries.length} />
          <Stat label="Total points" value={points} tone="gold" />
          <Stat label="Live matches" value={liveCount} tone={liveCount > 0 ? "danger" : undefined} />
          <Stat label="Active comps" value={comps.length} />
        </div>

        {/* Fantasy section */}
        <div className="mt-8">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-fg">My fantasy</h2>
            <Link href="/fantasy" className="text-sm font-semibold text-brand hover:underline">
              Browse all →
            </Link>
          </div>

          {comps.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-line-strong bg-bg-elevated p-8 text-center text-sm text-muted">
              No active competitions right now. Fantasy opens once an admin creates one.
            </p>
          ) : (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {entries.map((c) => (
                <Link
                  key={c.id}
                  href={`/fantasy/${c.id}`}
                  className="rounded-2xl border-2 border-fg/15 bg-bg-elevated p-5 shadow-[4px_4px_0_rgba(11,32,48,.06)] transition-all hover:-translate-y-0.5 hover:border-brand/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-extrabold text-fg">{c.name}</p>
                      <p className="text-xs text-subtle">{c.season} · {c.teams} teams · {c.totalEntries} entries</p>
                    </div>
                    <Badge tone={c.type === "CUP" ? "info" : "pitch"}>{c.type === "CUP" ? "Cup" : "League"}</Badge>
                  </div>
                  {c.entry ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                      <Badge tone="gold">
                        {c.entry.points} pts
                      </Badge>
                      <Badge tone="neutral">#{c.entry.rank}</Badge>
                      <Badge tone="neutral">{c.entry.picks} picks</Badge>
                      <span className="ml-auto text-xs font-semibold text-brand">Manage →</span>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center justify-between gap-2 text-sm">
                      <span className="text-xs text-muted">You have no entry yet.</span>
                      <span className="font-semibold text-brand">Build your XI →</span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Wayfinding */}
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <QuickLink href="/live" icon="📺" title="Watch live" desc="Live quiz matches happening now." />
          <QuickLink href="/fixtures" icon="🗓️" title="Fixtures & results" desc="Scheduled and finished matches." />
          <QuickLink href="/compare" icon="⚖️" title="Compare" desc="Player and team head-to-heads." />
        </div>
      </div>
    </PublicShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "gold" | "danger" }) {
  const color = tone === "gold" ? "text-gold" : tone === "danger" ? "text-danger" : "text-fg";
  return (
    <div className="rounded-xl border-2 border-fg/15 bg-bg-elevated p-4">
      <p className={`text-2xl font-black tabular-nums ${color}`}>{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}

function QuickLink({ href, icon, title, desc }: { href: string; icon: string; title: string; desc: string }) {
  return (
    <Link href={href} className="group rounded-2xl border-2 border-fg/15 bg-bg-elevated p-5 transition-all hover:-translate-y-0.5 hover:border-brand/40">
      <p className="text-2xl" aria-hidden>{icon}</p>
      <p className="mt-2 font-bold text-fg group-hover:text-brand">{title}</p>
      <p className="text-xs text-muted">{desc}</p>
    </Link>
  );
}
