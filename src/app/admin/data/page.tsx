import Link from "next/link";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/app";
import { Badge, Card, cn } from "@/components/ui";
import { AdminTabs, type AdminTab } from "@/components/admin";
import { WalletAdjust, type WalletUser } from "@/components/wallet-admin";
import { formatKickoffWat } from "@/lib/format";
import { StatusBadge } from "../page";

export const dynamic = "force-dynamic";

const TAKE = 40;

export default async function AdminDataPage() {
  const user = await requireRole(["ADMIN"]);

  const [
    users, teams, matches, goals, timeline, competitions, counts, wallets,
  ] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: TAKE, select: { id: true, name: true, email: true, role: true, createdAt: true } }),
    prisma.team.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { members: true } } } }),
    prisma.match.findMany({
      orderBy: { createdAt: "desc" },
      take: TAKE,
      select: { id: true, code: true, homeName: true, awayName: true, homeScore: true, awayScore: true, status: true, scheduledAt: true, startedAt: true, finishedAt: true, competition: { select: { name: true } } },
    }),
    prisma.round.findMany({
      where: { decision: "GOAL", goalSubmission: { isNot: null } },
      orderBy: { decidedAt: "desc" },
      take: TAKE,
      include: {
        match: { select: { code: true, homeName: true, awayName: true } },
        goalSubmission: { include: { player: { include: { user: { select: { name: true } } } } } },
        assistPlayer: { include: { user: { select: { name: true } } } },
      },
    }),
    prisma.timelineEvent.findMany({ orderBy: { createdAt: "desc" }, take: TAKE, include: { match: { select: { code: true } } } }),
    prisma.competition.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { teams: true, matches: true } } } }),
    prisma.$transaction([
      prisma.user.count(),
      prisma.team.count(),
      prisma.match.count(),
      prisma.round.count({ where: { decision: "GOAL" } }),
    ]),
    prisma.user.findMany({
      orderBy: [{ virtualPoints: "desc" }, { createdAt: "asc" }],
      take: 200,
      select: { id: true, name: true, virtualPoints: true },
    }),
  ]);

  const walletUsers: WalletUser[] = wallets.map((u) => ({ id: u.id, name: u.name, balance: u.virtualPoints ?? 0 }));

  const tabs: AdminTab[] = [
    {
      key: "users",
      label: "Users",
      badge: counts[0],
      content: (
        <Card>
          <ul className="divide-y divide-line/70">
            {users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-fg">{u.name}</span>
                  <span className="block truncate text-xs text-subtle">{u.email}</span>
                </span>
                <Badge tone={u.role === "ADMIN" ? "danger" : u.role === "REFEREE" ? "gold" : u.role === "PLAYER" ? "pitch" : "neutral"}>
                  {u.role}
                </Badge>
              </li>
            ))}
            {users.length === 0 ? <li className="px-4 py-6 text-sm text-muted">No users yet.</li> : null}
          </ul>
          <p className="border-t border-line px-4 py-2 text-xs text-subtle">Latest {TAKE} of {counts[0]} users.</p>
        </Card>
      ),
    },
    {
      key: "teams",
      label: "Teams",
      badge: counts[1],
      content: (
        <Card>
          <ul className="divide-y divide-line/70">
            {teams.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 rounded bg-surface px-1.5 py-0.5 text-[10px] font-black text-subtle">{t.code}</span>
                  <Link href={`/teams/${t.slug}`} className="min-w-0 truncate font-medium text-fg hover:text-brand">{t.name}</Link>
                </span>
                <Badge tone="neutral">{t._count.members}/8 players</Badge>
              </li>
            ))}
            {teams.length === 0 ? <li className="px-4 py-6 text-sm text-muted">No teams yet.</li> : null}
          </ul>
        </Card>
      ),
    },
    {
      key: "matches",
      label: "Matches",
      badge: counts[2],
      content: (
        <Card>
          <ul className="divide-y divide-line/70">
            {matches.map((m) => (
              <li key={m.id}>
                <Link href={`/admin/matches/${m.code}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-surface">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-fg">
                      {m.homeName} <span className="tabular-nums text-subtle">{m.homeScore}–{m.awayScore}</span> {m.awayName}
                    </span>
                    <span className="block truncate text-xs text-subtle">
                      {m.code} · {m.competition?.name ?? "Friendly"}
                      {m.scheduledAt ? ` · 🗓️ ${formatKickoffWat(m.scheduledAt.toISOString())}` : ""}
                    </span>
                  </span>
                  <StatusBadge status={m.status} />
                </Link>
              </li>
            ))}
            {matches.length === 0 ? <li className="px-4 py-6 text-sm text-muted">No matches yet.</li> : null}
          </ul>
          <p className="border-t border-line px-4 py-2 text-xs text-subtle">Latest {TAKE} of {counts[2]} matches.</p>
        </Card>
      ),
    },
    {
      key: "goals",
      label: "Goals",
      badge: counts[3],
      content: (
        <Card>
          <ul className="divide-y divide-line/70">
            {goals.map((g) => {
              const scorer = g.goalSubmission?.player.user.name ?? "Unknown";
              const team = g.goalSubmission?.player.team === "HOME" ? g.match.homeName : g.match.awayName;
              return (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-fg">
                      ⚽ {scorer} <span className="text-subtle">({team})</span>
                      {g.assistPlayer ? <span className="text-muted"> · assist: {g.assistPlayer.user.name}</span> : null}
                    </span>
                    <span className="block truncate text-xs text-subtle">Q{g.number} · {g.match.homeName} v {g.match.awayName}</span>
                  </span>
                  <Link href={`/match/${g.match.code}`} className="shrink-0 rounded-lg bg-surface px-2.5 py-1 text-xs font-semibold text-fg hover:bg-line">
                    Open
                  </Link>
                </li>
              );
            })}
            {goals.length === 0 ? <li className="px-4 py-6 text-sm text-muted">No goals recorded yet.</li> : null}
          </ul>
        </Card>
      ),
    },
    {
      key: "timeline",
      label: "Timeline",
      content: (
        <Card>
          <ul className="divide-y divide-line/70">
            {timeline.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-fg">{t.label}</span>
                  {t.detail ? <span className="block truncate text-xs text-subtle">{t.detail}</span> : null}
                </span>
                <span className="shrink-0 text-xs text-subtle">
                  <Link href={`/match/${t.match.code}`} className="font-semibold text-brand hover:underline">{t.match.code}</Link>
                  {" · "}
                  {new Date(t.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
            {timeline.length === 0 ? <li className="px-4 py-6 text-sm text-muted">No timeline events yet.</li> : null}
          </ul>
        </Card>
      ),
    },
    {
      key: "competitions",
      label: "Competitions",
      badge: competitions.length,
      content: (
        <Card>
          <ul className="divide-y divide-line/70">
            {competitions.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <Link href={`/competition/${c.slug}`} className="block truncate font-medium text-fg hover:text-brand">{c.name}</Link>
                  <span className="block truncate text-xs text-subtle">{c.season} · {c._count.teams} teams · {c._count.matches} matches</span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone="info">{c.type}</Badge>
                  <StatusBadge status={c.status} />
                </span>
              </li>
            ))}
            {competitions.length === 0 ? <li className="px-4 py-6 text-sm text-muted">No competitions yet.</li> : null}
          </ul>
        </Card>
      ),
    },
    {
      key: "wallets",
      label: "Wallets",
      badge: walletUsers.length,
      content: (
        <Card className="p-0">
          <WalletAdjust users={walletUsers} />
          <ul className="divide-y divide-line/70">
            {walletUsers.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="min-w-0 truncate font-medium text-fg">{u.name}</span>
                <span className={cn("shrink-0 font-black tabular-nums", u.balance > 0 ? "text-success" : u.balance < 0 ? "text-danger" : "text-subtle")}>
                  {u.balance} pts
                </span>
              </li>
            ))}
            {walletUsers.length === 0 ? <li className="px-4 py-6 text-sm text-muted">No users yet.</li> : null}
          </ul>
          <p className="border-t border-line px-4 py-2 text-xs text-subtle">
            Top {walletUsers.length} balances · point history lives in each user&apos;s Wallet tab.
          </p>
        </Card>
      ),
    },
  ];

  return (
    <>
      <TopBar name={user.name} role={user.role} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-fg">Database</h1>
          <p className="text-sm text-muted">A simple read-only view of everything stored — users, teams, matches, goals and more.</p>
        </div>
        <AdminTabs tabs={tabs} />
      </main>
    </>
  );
}
