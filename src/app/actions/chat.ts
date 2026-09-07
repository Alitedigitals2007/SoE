"use server";

import { prisma } from "@/lib/prisma";
import { currentActor } from "@/lib/session";
import { sendChatMessage, getChatMessages, type ChatMessageView } from "@/lib/match/chat";
import type { ActionResult } from "@/lib/domain";

const cooldown = new Map<string, number>();

export async function sendChatMessageAction(
  matchId: string,
  content: string,
): Promise<ActionResult<ChatMessageView>> {
  const actor = await currentActor();
  if (!actor) return { ok: false, error: "Sign in to chat." };

  const trimmed = content.trim();
  if (!trimmed) return { ok: false, error: "Message cannot be empty." };
  if (trimmed.length > 500) return { ok: false, error: "Message must be 500 characters or fewer." };

  // Lightweight per-user cooldown (per process). Not a hard guarantee across
  // many serverless instances, but it stops trivial flooding.
  const key = `${actor.userId}:${matchId}`;
  const now = Date.now();
  const last = cooldown.get(key) ?? 0;
  if (now - last < 2000) return { ok: false, error: "Please wait a moment before sending another message." };
  cooldown.set(key, now);

  const match = await prisma.match.findUnique({ where: { id: matchId }, select: { id: true, code: true } });
  if (!match) return { ok: false, error: "Match not found." };

  // Check the user is either a player in this match or a spectator (any signed-in user).
  // Players and spectators can all chat; no additional gating beyond being signed in.
  try {
    const msg = await sendChatMessage(matchId, actor.userId, trimmed);
    return { ok: true, data: msg };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to send message.";
    return { ok: false, error: msg };
  }
}

export async function getChatMessagesAction(
  matchId: string,
): Promise<ActionResult<ChatMessageView[]>> {
  try {
    const msgs = await getChatMessages(matchId);
    return { ok: true, data: msgs };
  } catch {
    return { ok: false, error: "Could not load chat messages." };
  }
}
