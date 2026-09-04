import Link from "next/link";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/app";
import { Card, CardHeader } from "@/components/ui";
import { StatusBadge } from "@/app/admin/page";

export const dynamic = "force-dynamic";

export default async function RefereeHome() {
  const user = await requireRole(["REFEREE"]);
  const matches = await prisma.match.findMany({
    where: { refereeId: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { roster: true } } },
  });

  return (
    <>
      <TopBar name={user.name} role={user.role} />
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        <h1 className="text-2xl font-bold text-fg">Your matches</h1>
        <p className="mb-5 text-sm text-muted">Matches the admin has assigned you to referee.</p>

        {matches.length === 0 ? (
          <Card>
            <CardHeader title="Nothing here yet" description="Ask the admin to create a match and assign you as referee." />
          </Card>
        ) : (
          <div className="space-y-2">
            {matches.map((m) => {
              const live = m.status === "LIVE";
              const setup = m.status === "DRAFT";
              const href = setup ? `/referee/matches/${m.code}/setup` : `/match/${m.code}`;
              return (
                <Link key={m.id} href={href} className="block rounded-lg border border-line bg-bg-elevated p-4 transition-colors hover:border-line-strong">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-base font-bold text-fg">
                      {m.homeName} <span className="text-subtle">v</span> {m.awayName}
                    </span>
                    <span className="flex items-center gap-2">
                      <StatusBadge status={m.status} />
                      {live ? <LiveHint /> : null}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    Code <span className="font-semibold text-gold">{m.code}</span> · {m._count.roster}/16 players · {m.countdownSeconds}s countdown
                  </p>
                  {setup ? <p className="mt-2 text-xs text-warning">Prepare the ten questions and line-ups, then kick off.</p> : null}
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}

function LiveHint() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
      <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-success" />
      Control room ready
    </span>
  );
}
