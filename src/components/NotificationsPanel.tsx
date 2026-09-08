"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/actions/notifications";
import { Button, cn } from "@/components/ui";
import type { AppNotification } from "@/lib/notify";

export function NotificationsPanel({ initial }: { initial: AppNotification[] }) {
  const router = useRouter();
  const [items, setItems] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);

  function markRead(id: string) {
    if (items.find((i) => i.id === id)?.readAt) return;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, readAt: new Date().toISOString() } : i)));
    void markNotificationReadAction(id).then(() => router.refresh());
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">{items.length} total</p>
        {items.some((i) => !i.readAt) ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setItems((prev) => prev.map((i) => (i.readAt ? i : { ...i, readAt: new Date().toISOString() })));
              void markAllNotificationsReadAction().then(() => {
                setBusy(false);
                router.refresh();
              });
            }}
          >
            Mark all read
          </Button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-fg/15 bg-bg-elevated p-10 text-center">
          <p className="text-4xl" aria-hidden>🔕</p>
          <p className="mt-2 font-semibold text-fg">No notifications yet</p>
          <p className="text-sm text-muted">Match alerts and big moments will appear here.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => markRead(n.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors",
                  n.readAt ? "border-fg/10 bg-bg-elevated opacity-70" : "border-brand/30 bg-brand/5",
                )}
              >
                <span aria-hidden className="mt-0.5">{n.link ? "🔗" : "•"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-fg">{n.title}</span>
                  {n.body ? <span className="block text-sm text-muted">{n.body}</span> : null}
                  <span className="mt-0.5 block text-[11px] text-subtle">
                    {new Date(n.createdAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {n.readAt ? " · read" : ""}
                  </span>
                </span>
                {n.link ? (
                  <Link href={n.link} className="shrink-0 text-xs font-semibold text-brand hover:underline" onClick={(e) => e.stopPropagation()}>
                    View →
                  </Link>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
