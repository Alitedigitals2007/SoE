"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createNewsAction, deleteNewsAction, setNewsPublishedAction } from "@/app/actions/news";
import { Button, Card, CardHeader, Field, Input, Textarea, cn } from "@/components/ui";

export type NewsRow = { id: string; title: string; slug: string; excerpt: string; published: boolean; createdAt: string };

type Notice = { kind: "ok" | "err"; text: string } | null;

function useFlash() {
  const [notice, setNotice] = React.useState<Notice>(null);
  const router = useRouter();
  function flash(r: { ok: boolean; error?: string }, okText: string) {
    if (r.ok) {
      setNotice({ kind: "ok", text: okText });
      router.refresh();
    } else {
      setNotice({ kind: "err", text: r.error ?? "Something went wrong." });
    }
  }
  return { notice, flash, router };
}

export function NewsManager({ posts }: { posts: NewsRow[] }) {
  const { notice, flash, router } = useFlash();
  const [title, setTitle] = React.useState("");
  const [excerpt, setExcerpt] = React.useState("");
  const [body, setBody] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="h-fit">
        <CardHeader title="Write a post" description="Published posts appear publicly under /news." />
        <form
          className="space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            void createNewsAction({ title, excerpt, body, imageUrl: imageUrl || null }).then((r) => {
              setBusy(false);
              if (r.ok) {
                setTitle("");
                setExcerpt("");
                setBody("");
                setImageUrl("");
                router.refresh();
              } else {
                flash(r, "");
              }
            });
          }}
        >
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Matchday 5 preview" required />
          </Field>
          <Field label="Excerpt (shown on the news list)">
            <Input value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="One-line summary under 220 chars" required maxLength={220} />
          </Field>
          <Field label="Body" hint="Plain text or simple paragraphs. Blank lines become spacing.">
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-40" required />
          </Field>
          <Field label="Cover image URL (optional)">
            <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…/cover.jpg" />
          </Field>
          <Button type="submit" loading={busy}>
            Publish post
          </Button>
          {notice ? <p className={cn("text-sm", notice.kind === "err" ? "text-danger" : "text-success")}>{notice.text}</p> : null}
        </form>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-bold text-fg">Posts ({posts.length})</h2>
        {posts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong p-6 text-sm text-muted">No posts yet.</p>
        ) : (
          posts.map((p) => (
            <div key={p.id} className="rounded-xl border-2 border-fg/15 bg-bg-elevated p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-fg">{p.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">{p.excerpt}</p>
                </div>
                <span
                  className={
                    p.published
                      ? "shrink-0 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] font-bold uppercase text-success"
                      : "shrink-0 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-bold uppercase text-warning"
                  }
                >
                  {p.published ? "Live" : "Draft"}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                <Link href={`/news/${p.slug}`} className="font-semibold text-brand hover:underline">
                  View →
                </Link>
                <button
                  className="text-subtle underline-offset-2 hover:text-brand hover:underline"
                  onClick={() => void setNewsPublishedAction(p.id, !p.published).then((r) => flash(r, p.published ? "Unpublished." : "Published."))}
                >
                  {p.published ? "Unpublish" : "Publish"}
                </button>
                <button
                  className="text-subtle underline-offset-2 hover:text-danger hover:underline"
                  onClick={() => {
                    if (confirm(`Delete "${p.title}"?`)) void deleteNewsAction(p.id).then((r) => flash(r, "Post deleted."));
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
