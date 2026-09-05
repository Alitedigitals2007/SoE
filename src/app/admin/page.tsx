import Link from "next/link";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/app";
import { Badge, Card, CardHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const user = await requireRole(["ADMIN"]);
  const [userCounts, matchCounts, recent] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.match.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.match.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { referee: { select: { name: true } } },
    }),
  ]);

  const count = (role?: string) =>
    userCounts.find((r) => r.role === role)?._count._all ?? 0;

  const matchCount = (status?: string) =>
    matchCounts.find((m) => m.status === status)?._count._all ?? 0;

  return (
    <>
      <TopBar name={user.name} role={user.role} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-fg">Admin</h1>
            <p className="text-sm text-muted">Accounts, matches and fixtures — the Stadium control room.</p>
          </div>
          <Link href="/admin/matches/new" className="inline-flex h-10 items-center gap-2 rounded-lg bg-gold px-4 text-sm font-medium text-gold-ink transition-colors hover:bg-gold-strong">
            + New match
          </Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <StatCard label="Referees" value={count("REFEREE")} to="/admin/users" />
          <StatCard label="Players" value={count("PLAYER")} to="/admin/users" />
          <StatCard label="Matches" value={matchCount("DRAFT") + matchCount("LIVE") + matchCount("FINISHED")} to="/admin/matches" />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Recent matches"
              description="Latest fixtures created"
              aside={
                <Link href="/admin/matches" className="text-xs font-medium text-gold hover:underline">
                  View all
                </Link>
              }
            />
            <ul className="divide-y divide-line/70">
              {recent.length === 0 ? (
                <li className="px-4 py-6 text-sm text-muted">No matches yet — create the first one.</li>
              ) : (
                recent.map((m) => (
                  <li key={m.id}>
                    <Link href={`/admin/matches/${m.code}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-surface">
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-fg">
                          {m.homeName} <span className="text-subtle">v</span> {m.awayName}
                        </span>
                        <span className="text-xs text-subtle">
                          Code {m.code} · {m.referee?.name ?? "Unassigned"}
                        </span>
                      </span>
                      <StatusBadge status={m.status} />
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Quick actions" />
            <div className="flex flex-col gap-2 p-3 text-sm">
              <ActionLink href="/admin/users" label="Manage accounts" hint="Create referee & player logins" />
              <ActionLink href="/admin/imports" label="Import centre" hint="Bulk-load accounts, squads, questions and fixtures" />
              <ActionLink href="/admin/teams" label="Teams" hint="Create clubs and add their 8 players" />
              <ActionLink href="/admin/competitions" label="Competitions" hint="Leagues, cups, fixtures & referees" />
              <ActionLink href="/admin/news" label="Newsroom" hint="Write and publish public posts" />
              <ActionLink href="/admin/matches/new" label="Create a friendly" hint="A one-off match with teams of your choice" />
              <ActionLink href="/admin/matches" label="Open a roster" hint="Assign players to a match's teams" />
            </div>
          </Card>
        </div>
      </main>
    </>
  );
}

function StatCard({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <Link href={to} className="rounded-lg border border-line bg-bg-elevated p-4 transition-colors hover:border-line-strong">
      <p className="text-3xl font-black tabular-nums text-gold">{value}</p>
      <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
    </Link>
  );
}

function ActionLink({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-md border border-line bg-bg-raised px-3 py-2.5 transition-colors hover:border-gold/40">
      <span>
        <span className="block font-medium text-fg">{label}</span>
        <span className="text-xs text-subtle">{hint}</span>
      </span>
      <span aria-hidden className="text-subtle">→</span>
    </Link>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone = status === "LIVE" ? "success" : status === "FINISHED" ? "neutral" : "warning";
  const label = status === "LIVE" ? "Live" : status === "FINISHED" ? "Finished" : "Setup";
  return <Badge tone={tone as never}>{label}</Badge>;
}
