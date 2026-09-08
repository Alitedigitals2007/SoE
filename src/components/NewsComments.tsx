"use client";

import * as React from "react";
import { addNewsCommentAction } from "@/app/actions/news";
import { Button, Input, Textarea, cn } from "@/components/ui";

export type CommentRow = { id: string; authorName: string; content: string; createdAt: string };
export type NewsCommentsProps = {
  postId: string;
  slug: string;
  signedIn: boolean;
  initial: CommentRow[];
};

export function NewsComments({ slug, signedIn, initial }: NewsCommentsProps) {
  const [rows, setRows] = React.useState<CommentRow[]>(initial);
  const [content, setContent] = React.useState("");
  const [guestName, setGuestName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <section className="mt-10 border-t-2 border-fg/10 pt-6">
      <h2 className="text-lg font-bold text-fg">Comments ({rows.length})</h2>

      <form
        className="mt-3 space-y-3 rounded-xl border-2 border-fg/15 bg-bg-elevated p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError(null);
          void addNewsCommentAction({ slug, content, guestName: signedIn ? null : guestName || null }).then((r) => {
            setBusy(false);
            if (r.ok && r.data) {
              setRows((prev) => [...prev, r.data]);
              setContent("");
            } else if (!r.ok) {
              setError(r.error);
            }
          });
        }}
      >
        {!signedIn ? (
          <Input
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Temporary name (or sign in to comment as yourself)"
            maxLength={50}
            className="max-w-xs"
          />
        ) : null}
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share a thought…"
          maxLength={500}
          rows={3}
          required
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={busy} disabled={!content.trim()}>
            Post comment
          </Button>
          <p className="text-xs text-subtle">{signedIn ? "Commenting as you." : "A temporary name is all you need."}</p>
        </div>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      </form>

      <ul className="mt-4 space-y-3">
        {rows.length === 0 ? (
          <li className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-muted">
            No comments yet — be the first.
          </li>
        ) : (
          rows.map((c) => (
            <li key={c.id} className="rounded-xl border-2 border-fg/10 bg-bg-elevated px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-muted">
                <span className="font-bold text-brand">{c.authorName}</span>
                <span aria-hidden>·</span>
                <time dateTime={c.createdAt}>
                  {new Date(c.createdAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </time>
              </div>
              <p className={cn("mt-1 whitespace-pre-wrap text-sm text-fg")}>{c.content}</p>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
