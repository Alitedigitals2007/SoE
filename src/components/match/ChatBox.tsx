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
}

export function ChatBox({ matchId, matchCode, className }: ChatBoxProps) {
  const [messages, setMessages] = React.useState<ChatMessageView[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = React.useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Load initial messages
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const res = await getChatMessagesAction(matchId);
      if (!cancelled && res.ok) {
        setMessages(res.data);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [matchId, open]);

  // Subscribe to realtime chat messages
  React.useEffect(() => {
    if (!open) return;
    let pusherSub: { unsubscribe: () => void; disconnect: () => void } | null = null;
    let ablySub: { close: () => void } | null = null;
    let cancelled = false;

    async function subscribePusher() {
      const mod = await import("pusher-js");
      const client = new mod.default(PUSHER_KEY, { cluster: PUSHER_CLUSTER });
      const channel = client.subscribe(`match-${matchCode}:chat`);
      channel.bind("chat-message", (data: { message: ChatMessageView }) => {
        if (!cancelled) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
        }
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
        if (!cancelled && data.message) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.message!.id)) return prev;
            return [...prev, data.message!];
          });
        }
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
  }, [matchCode, open]);

  // Auto-scroll on new messages
  React.useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

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

  return (
    <div className={cn("rounded-2xl border-2 border-fg/15 bg-bg-elevated shadow-[4px_4px_0_rgba(11,32,48,.08)]", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between border-b-2 border-line px-5 py-3 text-left"
      >
        <span className="text-sm font-semibold uppercase tracking-wider text-fg">Match Chat</span>
        <span className={cn("text-xs transition-transform", open && "rotate-180")}>▼</span>
      </button>

      {open && (
        <div className="flex flex-col" style={{ height: 320 }}>
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {loading ? (
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
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSend} className="flex gap-2 border-t border-line px-3 py-2">
            <input
              autoFocus
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
        </div>
      )}
    </div>
  );
}
