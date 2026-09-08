"use server";

import { currentActor } from "@/lib/session";
import { listNotifications, markAllRead, markNotificationRead, unreadCount } from "@/lib/notify";

export async function getNotificationsAction() {
  const actor = await currentActor();
  if (!actor) return { ok: false as const, error: "Sign in to see notifications." };
  const [items, unread] = await Promise.all([listNotifications(actor.userId), unreadCount(actor.userId)]);
  return { ok: true as const, data: { items, unread } };
}

export async function markNotificationReadAction(id: string) {
  const actor = await currentActor();
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  await markNotificationRead(id, actor.userId);
  return { ok: true as const, data: undefined };
}

export async function markAllNotificationsReadAction() {
  const actor = await currentActor();
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  await markAllRead(actor.userId);
  return { ok: true as const, data: undefined };
}
