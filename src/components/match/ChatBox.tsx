"use client";

import * as React from "react";
import { sendChatMessageAction, getChatMessagesAction } from "@/app/actions/chat";
import { Button, Spinner, cn } from "@/components/ui";
import type { ChatMessageView } from "@/lib/match/chat";

const PUSHER_KEY = process.env.NEXT_PUBLIC_PUSHER_KEY ?? "";
const PUSHER_CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "eu";
const ABLY_KEY = process.env.NEXT_PUBLIC_ABLY_KEY ?? "";

interface ChatBoxProps {
  matchId: string;
  matchCode: string;
  className?: string;
  /**
   * Docked mode — a floating widget pinned to the bottom-right corner so the
   * chat stays reachable during gameplay instead of sitting below the fold.
   * Shows an unread counter while it is closed.
   */
  docked?: boolean;
}

export function ChatBox({ matchId, matchCode, className, docked = false }: ChatBoxProps) {
  const [messages, setMessages] = React.useState<ChatMessageView[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [unread, setUnread] = React.useState(0);
  const seenRef = React.useRef(0);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = React.useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const noteIncoming = React.useCallback((incoming: ChatMessageView) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === incoming.id)) return prev;
      return [...prev, incoming];
    });
    setUnread((u) => u + 1);
  }, []);

  // Load initial messages (once, on mount) so the counter is meaningful
  // even while the widget is still closed.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getChatMessagesAction(matchId);
      if (!cancelled && res.ok) {
        setMessages(res.data);
        seenRef.current = res.data.length;
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [matchId]);

  // Subscribe to realtime chat messages — always, so nothing is missed while closed
  React.useEffect(() => {
    let pusherSub: { unsubscribe: () => void; disconnect: () => void } | null = null;
    let ablySub: { close: () => void } | null = null;
    let cancelled = false;

    async function subscribePusher() {
      const mod = await import("pusher-js");
      const client = new mod.default(PUSHER_KEY, { cluster: PUSHER_CLUSTER });
      const channel = client.subscribe(`match-${matchCode}:chat`);
      channel.bind("chat-message", (data: { message: ChatMessageView }) => {
        if (!cancelled) noteIncoming(data.message);
      });
      pusherSub = {
        unsubscribe: () => void client.unsubscribe(`match-${matchCode}:chat`),
        disconnect: () => void client.disconnect(),
      };
    }

    async function subscribeAbly() {
      const mod = await import("ably");
      const client = new mod.default.Realtime({ key: ABLY_KEY, echoMessages: false });
      const channel = client.channels.get(`match-${matchCode}:chat`);
      await channel.subscribe("chat-message", (msg) => {
        const data = (msg?.data ?? {}) as { message?: ChatMessageView };
        if (!cancelled && data.message) noteIncoming(data.message);
      });
      ablySub = { close: () => void client.close() };
    }

    (async () => {
      if (cancelled) return;
      if (PUSHER_KEY) {
        try {
          await subscribePusher();
          return;
        } catch { /* fall through */ }
      }
      if (ABLY_KEY) {
        try {
          await subscribeAbly();
          return;
        } catch { /* fall through */ }
      }
    })();

    return () => {
      cancelled = true;
      pusherSub?.unsubscribe();
      pusherSub?.disconnect();
      ablySub?.close();
    };
  }, [matchCode, noteIncoming]);

  // Auto-scroll on new messages
  React.useEffect(() => {
    if (open) scrollToBottom();
  }, [messages.length, open, scrollToBottom]);

  const openChat = React.useCallback(() => {
    setOpen(true);
    setUnread(0);
    seenRef.current = messages.length;
  }, [messages.length]);

  const closeChat = React.useCallback(() => setOpen(false), []);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    const res = await sendChatMessageAction(matchId, trimmed);
    if (res.ok) {
      // Message arrives via realtime; if realtime is down, add locally as fallback
      setMessages((prev) => {
        if (prev.some((m) => m.id === res.data.id)) return prev;
        return [...prev, res.data];
      });
      setInput("");
    }
    setBusy(false);
  }

  const messageList = loading ? (
    <div className="flex items-center justify-center py-8 text-muted">
      <Spinner className="size-4 mr-2" /> Loading messages…
    </div>
  ) : messages.length === 0 ? (
    <p className="py-8 text-center text-xs text-subtle">No messages yet. Say something!</p>
  ) : (
    <ul className="space-y-2">
      {messages.map((m) => (
        <li key={m.id} className="text-sm">
          <span className="font-semibold text-fg">{m.userName}</span>
          <span className="ml-1.5 text-muted">{m.content}</span>
          <span className="ml-1 text-[10px] text-subtle">
            {new Date(m.createdAt).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit" })}
          </span>
        </li>
      ))}
    </ul>
  );

  const composer = (
    <form onSubmit={handleSend} className="flex gap-2 border-t border-line px-3 py-2">
      <input
        autoFocus={open}
        maxLength={500}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type a message…"
        className="min-w-0 flex-1 rounded-lg border border-line-strong bg-bg-raised px-3 py-2 text-sm text-fg placeholder:text-subtle focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
      />
      <Button type="submit" size="sm" disabled={!input.trim() || busy} loading={busy}>
        Send
      </Button>
    </form>
  );

  if (docked) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-end p-3 sm:p-4">
        {open ? (
          <section
            aria-label="Match chat"
            className="pointer-events-auto flex w-[min(22rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border-2 border-fg/15 bg-bg-elevated shadow-[6px_6px_0_rgba(11,32,48,.16)]"
            style={{ height: "min(24rem,60vh)" }}
          >
            <header className="flex items-center justify-between border-b-2 border-line px-4 py-2.5">
              <span className="text-sm font-semibold uppercase tracking-wider text-fg">Match chat</span>
              <div className="flex items-center gap-2">
                {unread > 0 ? <UnreadBadge count={unread} /> : null}
                <button
                  type="button"
                  onClick={closeChat}
                  aria-label="Minimise chat"
                  className="rounded-md px-2 py-0.5 text-sm text-muted hover:bg-bg-raised hover:text-fg"
                >
                  ▼
                </button>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto px-3 py-2">{messageList}</div>
            <div ref={bottomRef} />
            {composer}
          </section>
        ) : (
          <button
            type="button"
            onClick={openChat}
            className="pointer-events-auto relative inline-flex items-center gap-2 rounded-full border-2 border-fg bg-brand px-4 py-2.5 text-sm font-bold text-white shadow-[4px_4px_0_rgba(11,32,48,.25)] transition-transform hover:-translate-y-0.5"
          >
            💬 Chat
            {unread > 0 ? <UnreadBadge count={unread} /> : null}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl border-2 border-fg/15 bg-bg-elevated shadow-[4px_4px_0_rgba(11,32,48,.08)]", className)}>
      <button
        type="button"
        onClick={() => (open ? closeChat() : openChat())}
        className="flex w-full items-center justify-between border-b-2 border-line px-5 py-3 text-left"
      >
        <span className="text-sm font-semibold uppercase tracking-wider text-fg">Match Chat</span>
        <span className="flex items-center gap-2">
          {!open && unread > 0 ? <UnreadBadge count={unread} /> : null}
          <span className={cn("text-xs transition-transform", open && "rotate-180")}>▼</span>
        </span>
      </button>

      {open && (
        <div className="flex flex-col" style={{ height: 320 }}>
          <div className="flex-1 overflow-y-auto px-3 py-2">{messageList}</div>
          <div ref={bottomRef} />
          {composer}
        </div>
      )}
    </div>
  );
}

function UnreadBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-black leading-none text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}
