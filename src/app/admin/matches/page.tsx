import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardHeader, Input } from "@/components/ui";
import { StatusBadge } from "../page";
import { UrlPagination } from "@/components/UrlPagination";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

export default async function AdminMatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = (sp.q ?? "").trim();

  const where = q
    ? {
        OR: [
          { code: { contains: q, mode: "insensitive" as const } },
          { homeName: { contains: q, mode: "insensitive" as const } },
          { awayName: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [matches, total] = await Promise.all([
    prisma.match.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        referee: { select: { name: true } },
        _count: { select: { roster: true } },
      },
    }),
    prisma.match.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
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

        <form action="/admin/matches" method="get" className="mt-4 flex gap-2 max-w-2xl">
          <Input
            name="q"
            value={q}
            placeholder="Search by code, home or away team…"
            className="max-w-md"
          />
          <button className="rounded-xl px-4 py-2.5 bg-fg text-white font-semibold hover:bg-brand transition-colors">
            Search
          </button>
          {q && (
            <Link href="/admin/matches" className="rounded-xl px-4 py-2.5 bg-surface text-fg font-semibold hover:bg-line transition-colors">
              Clear
            </Link>
          )}
        </form>

        <Card className="mt-5">
          <CardHeader title={`All matches (${total})`} />
          {matches.length === 0 ? (
            <p className="p-6 text-sm text-muted">{q ? "No matches match your search." : "No matches yet."}</p>
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
                        Code {m.code} · Referee {m.referee?.name ?? "Unassigned"} · {m._count.roster}/16 shirts filled
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
        <Suspense>
          <UrlPagination page={page} totalPages={totalPages} basePath="/admin/matches" />
        </Suspense>
      </main>
    </>
  );
}
