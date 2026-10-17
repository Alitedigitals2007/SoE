import { prisma } from "@/lib/prisma";

export type OpenTransferWindow = {
  id: string;
  season: string;
  name: string;
  openAt: Date | null;
  closeAt: Date | null;
};

/**
 * The currently active window: status OPEN and, when dates are set, within them.
 * At most one window should ever be OPEN — opening a window closes the others.
 */
export async function getOpenTransferWindow(): Promise<OpenTransferWindow | null> {
  const windows = await prisma.transferWindow.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    select: { id: true, season: true, name: true, openAt: true, closeAt: true },
  });
  const now = new Date();
  return (
    windows.find((w) => (!w.openAt || w.openAt <= now) && (!w.closeAt || w.closeAt >= now)) ?? null
  );
}
