import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PublicShell } from "@/components/site";
import { Badge } from "@/components/ui";
import { NewsComments, type CommentRow } from "@/components/NewsComments";

export const dynamic = "force-dynamic";

export default async function NewsDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await prisma.newsPost.findUnique({
    where: { slug },
    include: { author: { select: { name: true } } },
  });
  if (!post || !post.published) notFound();

  const session = await auth();
  const comments = await prisma.newsComment.findMany({
    where: { newsId: post.id },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  const commentRows: CommentRow[] = comments.map((c) => ({
    id: c.id,
    authorName: c.user?.name ?? c.guestName ?? "Anonymous",
    content: c.content,
    createdAt: c.createdAt.toISOString(),
  }));

  const paragraphs = post.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  return (
    <PublicShell>
      <article className="mx-auto max-w-3xl px-4 py-10">
        <Link href="/news" className="text-sm font-semibold text-brand underline-offset-2 hover:underline">
          ← All news
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted">
          <time dateTime={post.createdAt.toISOString()}>
            {post.createdAt.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
          </time>
          <Badge tone="neutral">By {post.author.name}</Badge>
        </div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-fg">{post.title}</h1>

        {post.imageUrl ? (
          <div className="mt-6 overflow-hidden rounded-2xl border-2 border-fg/15">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.imageUrl} alt="" className="max-h-96 w-full object-cover" />
          </div>
        ) : null}

        <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-fg">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        <div className="max-w-2xl">
          <NewsComments
            postId={post.id}
            slug={post.slug}
            signedIn={!!session?.user}
            initial={commentRows}
          />
        </div>
      </article>
    </PublicShell>
  );
}
