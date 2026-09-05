/**
 * Realtime publish layer with the agreed failover model:
 *   1. Pusher  (primary)  — triggered when configured
 *   2. Ably    (secondary) — also triggered when configured
 *   3. Polling (safety net) — clients reconcile on a timer regardless, so a
 *      dropped broadcast can never leave a screen stale for long.
 *
 * The event carries a timestamp only; clients compare to their last snapshot
 * version and refetch authoritative state when needed. Providers are created
 * lazily so the app runs with zero config (pure polling mode).
 */
import Pusher from "pusher";
import Ably from "ably";

let pusherClient: Pusher | null | undefined;
let ablyClient: Ably.Rest | null | undefined;

function getPusher(): Pusher | null {
  const { PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER } = process.env;
  if (!PUSHER_APP_ID || !PUSHER_KEY || !PUSHER_SECRET) return null;
  if (pusherClient === undefined) {
    pusherClient = new Pusher({
      appId: PUSHER_APP_ID,
      key: PUSHER_KEY,
      secret: PUSHER_SECRET,
      cluster: PUSHER_CLUSTER || "eu",
      useTLS: true,
    });
  }
  return pusherClient;
}

function getAbly(): Ably.Rest | null {
  const { ABLY_API_KEY } = process.env;
  if (!ABLY_API_KEY) return null;
  if (ablyClient === undefined) {
    ablyClient = new Ably.Rest(ABLY_API_KEY);
  }
  return ablyClient;
}

export function matchChannel(code: string): string {
  return `match-${code.toUpperCase()}`;
}

/**
 * Publish a state update for a match to every configured provider. Clients
 * treat any received event as a prompt to refetch the authoritative snapshot.
 */
export async function publishMatchUpdate(code: string): Promise<void> {
  const channel = matchChannel(code);
  const event = "state";
  const data = { code: code.toUpperCase(), at: new Date().toISOString() };

  const pusher = getPusher();
  if (pusher) {
    try {
      await pusher.trigger(channel, event, data);
    } catch (e) {
      console.warn("[realtime] Pusher publish failed (polling will reconcile):", e);
    }
  }

  const ably = getAbly();
  if (ably) {
    try {
      await ably.channels.get(channel).publish(event, data);
    } catch (e) {
      console.warn("[realtime] Ably publish failed (polling will reconcile):", e);
    }
  }
}

/* --------------------------------- chat ---------------------------------- */

export function chatChannel(code: string): string {
  return `match-${code.toUpperCase()}:chat`;
}

export async function publishChatMessage(
  code: string,
  message: { id: string; userId: string; userName: string; content: string; createdAt: string },
): Promise<void> {
  const channel = chatChannel(code);
  const event = "chat-message";
  const data = { code: code.toUpperCase(), message };

  const pusher = getPusher();
  if (pusher) {
    try {
      await pusher.trigger(channel, event, data);
    } catch (e) {
      console.warn("[realtime] Pusher chat publish failed:", e);
    }
  }

  const ably = getAbly();
  if (ably) {
    try {
      await ably.channels.get(channel).publish(event, data);
    } catch (e) {
      console.warn("[realtime] Ably chat publish failed:", e);
    }
  }
}
