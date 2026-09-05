import { prisma } from "@/lib/prisma";
import { PublicShell } from "@/components/site";
import { MatchLiveCard } from "@/components/live";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LivePage() {
  const matches = await prisma.match.findMany({ where: { status: "LIVE" }, orderBy: { startedAt: "asc" } });

  return (
    <PublicShell>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-black tracking-tight text-fg">Live now</h1>
              {matches.length > 0 ? (
                <Badge tone="danger">
                  <span className="size-1.5 animate-pulse rounded-full bg-danger" />
                  {matches.length} active
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted">Auto-refreshing — matches update as the referee runs them.</p>
          </div>
        </div>
        {matches.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-line-strong bg-bg-elevated p-10 text-center">
            <p className="text-4xl" aria-hidden>📺</p>
            <p className="mt-2 font-semibold text-fg">No matches are live right now</p>
            <p className="mt-1 text-sm text-muted">When a referee kicks off, the match streams here for everyone.</p>
          </div>
        ) : (
          <MatchLiveCard matches={matches} />
        )}
      </div>
    </PublicShell>
  );
}
