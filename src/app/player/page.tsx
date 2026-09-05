import Link from "next/link";
import { Suspense } from "react";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/app";
import { Badge, Card, CardHeader } from "@/components/ui";
import { StatusBadge } from "@/app/admin/page";
import { UrlPagination } from "@/components/UrlPagination";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

export default async function PlayerHome({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireRole(["PLAYER"]);
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const [slots, total] = await Promise.all([
    prisma.matchPlayer.findMany({
      where: { userId: user.id },
      orderBy: { match: { createdAt: "desc" } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        match: { include: { referee: { select: { name: true } } } },
      },
    }),
    prisma.matchPlayer.count({ where: { userId: user.id } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <TopBar name={user.name} role={user.role} />
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        <h1 className="text-2xl font-bold text-fg">Your matches</h1>
        <p className="mb-5 text-sm text-muted">Matches where you are on a roster.</p>

        {slots.length === 0 ? (
          <Card>
            <CardHeader title="No fixtures yet" description="Once an admin puts you on a roster, your matches appear here." />
          </Card>
        ) : (
          <div className="space-y-2">
            {slots.map((s) => {
              const team = s.team === "HOME" ? s.match.homeName : s.match.awayName;
              const other = s.team === "HOME" ? s.match.awayName : s.match.homeName;
              const mine = s.team === "HOME" ? "text-teama" : "text-teamb";
              const live = s.match.status === "LIVE";
              return (
                <Link key={s.id} href={`/match/${s.match.code}`} className="block rounded-lg border border-line bg-bg-elevated p-4 transition-colors hover:border-line-strong">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-base font-bold text-fg">
                      {s.match.homeName} <span className="text-subtle">v</span> {s.match.awayName}
                    </span>
                    <span className="flex items-center gap-2">
                      <StatusBadge status={s.match.status} />
                      {live ? <LiveDot /> : null}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    Code <span className="font-semibold text-gold">{s.match.code}</span> · You play for{" "}
                    <span className={`font-semibold ${mine}`}>{team}</span> (v {other})
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge tone="neutral">Shirt #{s.number}</Badge>
                    <Badge tone={s.role === "STARTER" ? "pitch" : s.role === "SUB" ? "warning" : "danger"}>
                      {s.role === "STARTER" ? "Starter" : s.role === "SUB" ? "Bench" : "Sent off"}
                    </Badge>
                    {s.isCaptain ? <Badge tone="gold">Captain</Badge> : null}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        <Suspense>
          <UrlPagination page={page} totalPages={totalPages} basePath="/player" />
        </Suspense>
      </main>
    </>
  );
}

function LiveDot() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
      <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-success" />
      Live
    </span>
  );
}
