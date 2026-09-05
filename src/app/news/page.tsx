import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PublicShell } from "@/components/site";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewsIndexPage() {
  const posts = await prisma.newsPost.findMany({
    where: { published: true },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <PublicShell>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <span className="section-kicker">Newsroom</span>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-fg">Latest news</h1>
        <p className="mt-1 text-muted">Club announcements, matchday previews and reports.</p>

        {posts.length === 0 ? (
          <div className="mt-8 rounded-2xl border-2 border-dashed border-fg/15 bg-bg-elevated p-10 text-center">
            <p className="text-4xl" aria-hidden>📰</p>
            <p className="mt-2 font-semibold text-fg">No news yet</p>
            <p className="text-sm text-muted">Check back soon for matchday announcements.</p>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {posts.map((p) => (
              <Link
                key={p.id}
                href={`/news/${p.slug}`}
                className="group flex gap-4 overflow-hidden rounded-2xl border-2 border-fg/15 bg-bg-elevated p-4 shadow-[4px_4px_0_rgba(11,32,48,.06)] transition-all hover:-translate-y-0.5 hover:border-brand/40"
              >
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="" className="hidden size-24 shrink-0 rounded-xl border border-fg/10 bg-white object-cover sm:block" />
                ) : null}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <time dateTime={p.createdAt.toISOString()}>
                      {p.createdAt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                    </time>
                    <Badge tone="neutral">{p.author.name}</Badge>
                  </div>
                  <h2 className="mt-1 text-lg font-extrabold text-fg group-hover:text-brand">{p.title}</h2>
                  <p className="mt-1 text-sm text-muted">{p.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PublicShell>
  );
}
