import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Interactive-transaction options for the heavy paths (match end, score
 * settlement, fantasy crediting): dozens of sequential round-trips on a remote
 * pooled database easily outgrow Prisma's 5s default and roll the whole update
 * back — leaving a match stuck live or a bet unplaced.
 */
export const TX_OPTS = { timeout: 30_000, maxWait: 10_000 } as const;
