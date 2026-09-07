import { prisma } from "@/lib/prisma";
import { publishChatMessage } from "@/lib/realtime/server";

export interface ChatMessageView {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

export async function sendChatMessage(
  matchId: string,
  userId: string,
  content: string,
): Promise<ChatMessageView> {
  const trimmed = content.trim();
  if (!trimmed || trimmed.length > 500) {
    throw new Error("Message must be 1–500 characters.");
  }

  const msg = await prisma.chatMessage.create({
    data: { matchId, userId, content: trimmed },
    include: { user: { select: { name: true } } },
  });

  const view: ChatMessageView = {
    id: msg.id,
    userId: msg.userId,
    userName: msg.user.name,
    content: msg.content,
    createdAt: msg.createdAt.toISOString(),
  };

  // Best-effort publish — don't let a realtime failure block the action.
  try {
    const match = await prisma.match.findUniqueOrThrow({ where: { id: matchId }, select: { code: true } });
    await publishChatMessage(match.code, view);
  } catch {
    /* polling will reconcile */
  }

  return view;
}

export async function getChatMessages(
  matchId: string,
  limit = 50,
): Promise<ChatMessageView[]> {
  const rows = await prisma.chatMessage.findMany({
    where: { matchId },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows
    .reverse()
    .map((r) => ({
      id: r.id,
      userId: r.userId,
      userName: r.user.name,
      content: r.content,
      createdAt: r.createdAt.toISOString(),
    }));
}
