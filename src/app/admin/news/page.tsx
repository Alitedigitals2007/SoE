import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/app";
import { NewsManager, type NewsRow } from "@/components/NewsManager";

export const dynamic = "force-dynamic";

export default async function AdminNewsPage() {
  const user = await requireRole(["ADMIN"]);
  const posts = await prisma.newsPost.findMany({
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const rows: NewsRow[] = posts.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt,
    published: p.published,
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <>
      <TopBar name={user.name} role={user.role} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <h1 className="text-2xl font-bold text-fg">News</h1>
        <p className="mt-1 text-sm text-muted">Announcements, previews and reports — shown publicly under /news.</p>
        <div className="mt-6">
          <NewsManager posts={rows} />
        </div>
      </main>
    </>
  );
}
