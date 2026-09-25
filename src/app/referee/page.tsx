import Link from "next/link";
import type { ReactNode } from "react";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/app";
import { Badge, Card, CardHeader } from "@/components/ui";
import { StatusBadge } from "@/app/admin/page";
import { formatKickoffWat } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * The referee's home: what is live, what is next, what just finished.
 * No pagination and no columns to scan — one obvious next action per match.
 */
export default async function RefereeHome() {
  const user = await requireRole(["REFEREE", "ADMIN"]);

  const [live, upcoming, finished] = await Promise.all([
    prisma.match.findMany({
      where: { refereeId: user.id, status: "LIVE" },
      orderBy: { startedAt: "asc" },
      include: { _count: { select: { roster: true } } },
    }),
    prisma.match.findMany({
      where: { refereeId: user.id, status: "DRAFT" },
      orderBy: [{ scheduledAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      take: 6,
      include: { _count: { select: { roster: true } } },
    }),
    prisma.match.findMany({
      where: { refereeId: user.id, status: "FINISHED" },
      orderBy: { finishedAt: "desc" },
      take: 5,
      include: { _count: { select: { roster: true } } },
    }),
  ]);

  return (
    <>
      <TopBar name={user.name} role={user.role} />
      <main className="mx-auto w-full max-w-4xl px-4 py-6">
        <h1 className="text-2xl font-bold text-fg">Your matches</h1>
        <p className="mb-5 text-sm text-muted">Everything you are refereeing, newest problem first.</p>

        {live.length === 0 && upcoming.length === 0 && finished.length === 0 ? (
          <Card>
            <CardHeader title="Nothing here yet" description="Ask the admin to create a match and assign you as referee." />
          </Card>
        ) : null}

        {live.length > 0 ? (
          <section className="space-y-2">
            <SectionTitle tone="danger">Live now</SectionTitle>
            {live.map((m) => (
              <Link
                key={m.id}
                href={`/match/${m.code}`}
                className="block rounded-xl border-2 border-success/50 bg-success/5 p-4 transition-all hover:-translate-y-0.5 hover:border-success"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-base font-bold text-fg">
                    {m.homeName} <span className="text-subtle">v</span> {m.awayName}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
                      <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-success" />
                      On the clock
                    </span>
                    <Badge tone="success">Open control room →</Badge>
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {m.homeScore}–{m.awayScore} · {m._count.roster}/16 players · Code{" "}
                  <span className="font-semibold text-gold">{m.code}</span>
                </p>
              </Link>
            ))}
          </section>
        ) : null}

        {upcoming.length > 0 ? (
          <section className="mt-6 space-y-2">
            <SectionTitle>Next up</SectionTitle>
            {upcoming.map((m) => {
              const rostered = m._count.roster >= 16;
              return (
                <Link
                  key={m.id}
                  href={`/referee/matches/${m.code}/setup`}
                  className="block rounded-xl border border-line bg-bg-elevated p-4 transition-colors hover:border-gold/50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-base font-bold text-fg">
                      {m.homeName} <span className="text-subtle">v</span> {m.awayName}
                    </span>
                    <span className="flex items-center gap-2">
                      <StatusBadge status={m.status} />
                      <Badge tone="gold">Prepare →</Badge>
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {m.scheduledAt ? `${formatKickoffWat(m.scheduledAt.toISOString())} · ` : "No kick-off set · "}
                    {m._count.roster}/16 players{rostered ? " — ready to go" : " — line-ups still short"}
                    {" · Code "}
                    <span className="font-semibold text-gold">{m.code}</span>
                  </p>
                </Link>
              );
            })}
          </section>
        ) : null}

        {finished.length > 0 ? (
          <section className="mt-6 space-y-2">
            <SectionTitle>Recently finished</SectionTitle>
            <Card>
              <ul className="divide-y divide-line/70">
                {finished.map((m) => (
                  <li key={m.id}>
                    <Link href={`/match/${m.code}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-surface">
                      <span className="min-w-0 truncate font-medium text-fg">
                        {m.homeName} <span className="text-subtle">v</span> {m.awayName}
                      </span>
                      <span className="shrink-0 text-sm font-black tabular-nums text-fg">
                        {m.homeScore}–{m.awayScore}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ) : null}
      </main>
    </>
  );
}

function SectionTitle({ children, tone }: { children: ReactNode; tone?: "danger" }) {
  return (
    <h2
      className={
        tone === "danger"
          ? "flex items-center gap-2 text-xs font-black uppercase tracking-widest text-success"
          : "text-xs font-black uppercase tracking-widest text-subtle"
      }
    >
      {children}
    </h2>
  );
}
