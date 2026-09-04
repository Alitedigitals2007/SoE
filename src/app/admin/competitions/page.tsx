import Link from "next/link";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/app";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminCompetitions() {
  const user = await requireRole(["ADMIN"]);
  const comps = await prisma.competition.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { teams: true, matches: true } } },
  });

  return (
    <>
      <TopBar name={user.name} role={user.role} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-fg">Competitions</h1>
            <p className="text-sm text-muted">Leagues and knockout cups. Set teams up, then generate fixtures.</p>
          </div>
          <Link href="/admin/competitions/new" className="inline-flex h-10 items-center rounded-lg brand-gradient px-4 text-sm font-semibold text-white shadow-sm hover:brightness-105">
            + New competition
          </Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {comps.length === 0 ? (
            <p className="text-sm text-muted">No competitions yet.</p>
          ) : (
            comps.map((c) => (
              <Link key={c.id} href={`/admin/competitions/${c.slug}`} className="rounded-2xl border border-line bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-lg font-extrabold text-fg">{c.name}</p>
                  <span aria-hidden className="text-xl">{c.type === "CUP" ? "🏆" : "📊"}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                  <Badge tone={c.type === "CUP" ? "info" : "pitch"}>{c.type === "CUP" ? "Cup" : "League"}</Badge>
                  <span>{c.season}</span>
                  <Badge tone={c.status === "FINISHED" ? "neutral" : c.status === "ACTIVE" ? "success" : "warning"}>{c.status}</Badge>
                </div>
                <p className="mt-3 text-sm text-muted">
                  {c._count.teams} teams · {c._count.matches} fixtures
                </p>
              </Link>
            ))
          )}
        </div>
      </main>
    </>
  );
}
