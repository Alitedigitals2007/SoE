"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * Wraps the server-rendered league table and keeps it live:
 *  • refreshes the route every few seconds while a match is in progress, so
 *    goals move the table without a full page reload;
 *  • animates rows with a FLIP transform, so teams glide up and down the
 *    standings the way a real matchday table does.
 */
export function LiveStandings({
  autoRefresh,
  intervalMs = 5000,
  children,
}: {
  /** true while this competition has a match being played. */
  autoRefresh: boolean;
  intervalMs?: number;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const prevTops = React.useRef<Map<string, number> | null>(null);

  const snapshotTops = React.useCallback(() => {
    const rows = rootRef.current?.querySelectorAll<HTMLElement>("[data-team]");
    if (!rows?.length) return;
    const map = new Map<string, number>();
    rows.forEach((el) => {
      const key = el.dataset.team;
      if (key) map.set(key, el.getBoundingClientRect().top);
    });
    prevTops.current = map;
  }, []);

  React.useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      snapshotTops();
      router.refresh();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [autoRefresh, intervalMs, router, snapshotTops]);

  // FLIP: play the delta between where a row was and where it landed.
  React.useLayoutEffect(() => {
    const prev = prevTops.current;
    prevTops.current = null;
    if (!prev) return;
    const rows = rootRef.current?.querySelectorAll<HTMLElement>("[data-team]");
    rows?.forEach((el) => {
      const key = el.dataset.team;
      if (!key) return;
      const before = prev.get(key);
      if (before === undefined) return;
      const delta = before - el.getBoundingClientRect().top;
      if (!delta || Math.abs(delta) < 2) return;
      el.animate(
        [{ transform: `translateY(${delta}px)`, backgroundColor: "rgba(212,167,44,.18)" }, { transform: "translateY(0)", backgroundColor: "transparent" }],
        { duration: 520, easing: "cubic-bezier(.22,1,.36,1)" },
      );
    });
  });

  return (
    <div ref={rootRef} data-live-table={autoRefresh ? "on" : "off"}>
      {children}
    </div>
  );
}
