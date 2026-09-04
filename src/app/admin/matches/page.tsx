import Link from "next/link";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/app";
import { Badge, Card, CardHeader } from "@/components/ui";
import { StatusBadge } from "../page";

export const dynamic = "force-dynamic";

export default async function AdminMatchesPage() {
  const user = await requireRole(["ADMIN"]);
  const matches = await prisma.match.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      referee: { select: { name: true } },
      _count: { select: { roster: true } },
    },
  });

  return (
    <>
      <TopBar name={user.name} role={user.role} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-fg">Matches</h1>
            <p className="text-sm text-muted">Open a match to manage its roster.</p>
          </div>
          <Link href="/admin/matches/new" className="inline-flex h-10 items-center rounded-lg bg-gold px-4 text-sm font-medium text-gold-ink hover:bg-gold-strong">
            + New match
          </Link>
        </div>

        <Card className="mt-5">
          <CardHeader title={`All matches (${matches.length})`} />
          {matches.length === 0 ? (
            <p className="p-6 text-sm text-muted">No matches yet.</p>
          ) : (
            <ul className="divide-y divide-line/70">
              {matches.map((m) => (
                <li key={m.id}>
                  <Link href={`/admin/matches/${m.code}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm transition-colors hover:bg-surface">
                    <span className="min-w-0">
                      <span className="block font-medium text-fg">
                        {m.homeName} <span className="text-subtle">v</span> {m.awayName}
                      </span>
                      <span className="text-xs text-subtle">
                        Code {m.code} · Referee {m.referee.name} · {m._count.roster}/16 shirts filled
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge tone="neutral">{m.countdownSeconds}s countdown</Badge>
                      <StatusBadge status={m.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </>
  );
}
