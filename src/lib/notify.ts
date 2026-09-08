import { prisma } from "@/lib/prisma";

export type AppNotification = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export async function notifyAllUsers(input: {
  title: string;
  body?: string;
  link?: string;
  icon?: string;
}): Promise<void> {
  const title = input.icon ? `${input.icon} ${input.title}` : input.title;
  const users = await prisma.user.findMany({ where: { role: { not: "ADMIN" } }, select: { id: true } });
  await prisma.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      title,
      body: input.body ?? null,
      link: input.link ?? null,
    })),
  });
}

export async function notifyUsers(userIds: string[], input: { title: string; body?: string; link?: string; icon?: string }): Promise<void> {
  if (userIds.length === 0) return;
  const title = input.icon ? `${input.icon} ${input.title}` : input.title;
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      title,
      body: input.body ?? null,
      link: input.link ?? null,
    })),
  });
}

export async function listNotifications(userId: string): Promise<AppNotification[]> {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    link: r.link,
    readAt: r.readAt ? r.readAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markNotificationRead(id: string, userId: string): Promise<void> {
  await prisma.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } });
}

export async function markAllRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}
