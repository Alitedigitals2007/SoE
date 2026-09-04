"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getMatchSnapshotAction, syncMatchAction } from "@/app/actions/match";
import type { MatchSnapshot } from "@/lib/domain";

const PUSHER_KEY = process.env.NEXT_PUBLIC_PUSHER_KEY ?? "";
const PUSHER_CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "eu";
const ABLY_KEY = process.env.NEXT_PUBLIC_ABLY_KEY ?? "";

export type LiveMode = "pusher" | "ably" | "poll";

/**
 * Subscribes a match view to live updates with failover:
 *   Pusher (if key configured) → Ably (if configured) → pure polling.
 * A slow reconciliation poll always runs as the final safety net, so a missed
 * broadcast can never leave the screen stale for more than a few seconds.
 */
export function useMatchState(code: string, initial: MatchSnapshot) {
  const [snapshot, setSnapshot] = useState<MatchSnapshot>(initial);
  const [mode, setMode] = useState<LiveMode>(() => {
    if (PUSHER_KEY) return "pusher";
    if (ABLY_KEY) return "ably";
    return "poll";
  });

  const snapshotRef = useRef(snapshot);
  const busyRef = useRef(false);
  const lastFetchAt = useRef(0);
  const disposedRef = useRef(false);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const refresh = useCallback(async () => {
    if (disposedRef.current || busyRef.current) return;
    const now = Date.now();
    if (now - lastFetchAt.current < 450) return; // coalesce bursts
    busyRef.current = true;
    lastFetchAt.current = now;
    try {
      const res = await getMatchSnapshotAction(code);
      if (res.ok) setSnapshot(res.data);
    } catch {
      /* transient — the poll will retry */
    } finally {
      busyRef.current = false;
    }
  }, [code]);

  const reconcile = useCallback(async () => {
    if (disposedRef.current || busyRef.current) return;
    busyRef.current = true;
    try {
      const res = await syncMatchAction(code);
      if (res.ok && res.data.version > snapshotRef.current.version) {
        busyRef.current = false;
        await refresh();
        return;
      }
    } catch {
      /* ignore */
    } finally {
      busyRef.current = false;
    }
  }, [code, refresh]);

  // Realtime subscription (Pusher primary, Ably secondary)
  useEffect(() => {
    disposedRef.current = false;
    let pusher: { unsubscribe: () => void; disconnect: () => void } | null = null;
    let ably: { close: () => void } | null = null;
    let cancelled = false;

    async function subscribePusher() {
      const mod = await import("pusher-js");
      const client = new mod.default(PUSHER_KEY, { cluster: PUSHER_CLUSTER });
      const channel = client.subscribe(`match-${code}`);
      channel.bind("state", () => void refresh());
      pusher = { unsubscribe: () => void client.unsubscribe(`match-${code}`), disconnect: () => void client.disconnect() };
    }

    async function subscribeAbly() {
      const mod = await import("ably");
      const client = new mod.default.Realtime({ key: ABLY_KEY, echoMessages: false });
      const channel = client.channels.get(`match-${code}`);
      await channel.subscribe("state", () => void refresh());
      ably = { close: () => void client.close() };
    }

    (async () => {
      if (cancelled) return;
      if (PUSHER_KEY) {
        try {
          await subscribePusher();
          if (!cancelled) setMode("pusher");
          return;
        } catch {
          /* fall through to Ably */
        }
      }
      if (ABLY_KEY) {
        try {
          await subscribeAbly();
          if (!cancelled) setMode("ably");
          return;
        } catch {
          /* fall through to polling */
        }
      }
      if (!cancelled) setMode("poll");
    })();

    return () => {
      cancelled = true;
      disposedRef.current = true;
      pusher?.unsubscribe();
      pusher?.disconnect();
      ably?.close();
    };
  }, [code, refresh]);

  // Reconciliation poll: fast in pure-polling mode, slower heartbeat otherwise.
  useEffect(() => {
    const delay = mode === "poll" ? 2500 : 7000;
    const t = window.setInterval(() => void reconcile(), delay);
    const onFocus = () => void reconcile();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [mode, reconcile]);

  return { snapshot, mode, refresh };
}
