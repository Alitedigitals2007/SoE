import { prisma } from "@/lib/prisma";
import type { Prisma, WalletTxnKind } from "@prisma/client";

type Db = Prisma.TransactionClient | typeof prisma;

export const WELCOME_POINTS = 100;

/**
 * Ensure the user's wallet exists. A brand-new wallet is opened with the
 * 100-point welcome bonus and a WELCOME ledger entry so the transaction
 * history shows where the first points came from.
 *
 * Returns the current balance (and the flag wasNew when the wallet was opened).
 */
export async function ensureWallet(db: Db, userId: string): Promise<{ balance: number; wasNew: boolean }> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { virtualPoints: true } });
  if (!user) throw new Error("User not found.");
  if (user.virtualPoints !== null) return { balance: user.virtualPoints, wasNew: false };

  // Atomic claim: only the request that flips NULL → 100 opens the wallet and
  // writes the WELCOME ledger entry (concurrent first-touches see count 0).
  const claimed = await db.user.updateMany({
    where: { id: userId, virtualPoints: null },
    data: { virtualPoints: WELCOME_POINTS },
  });
  if (claimed.count === 1) {
    await db.walletTransaction.create({
      data: {
        userId,
        amount: WELCOME_POINTS,
        balanceAfter: WELCOME_POINTS,
        kind: "WELCOME",
        note: "Welcome bonus — virtual points to get you started",
      },
    });
    return { balance: WELCOME_POINTS, wasNew: true };
  }
  const again = await db.user.findUnique({ where: { id: userId }, select: { virtualPoints: true } });
  return { balance: again?.virtualPoints ?? 0, wasNew: false };
}

/**
 * Apply a signed amount to the wallet and append a ledger entry.
 * Positive = credit, negative = debit. Never lets the balance go below 0
 * (credits are always fully applied; oversized debits clamp at zero).
 */
export async function applyWalletTxn(
  db: Db,
  userId: string,
  amount: number,
  kind: WalletTxnKind,
  note: string,
  refs: { matchId?: string | null; betId?: string | null } = {},
): Promise<number> {
  const { balance } = await ensureWallet(db, userId);
  const applied = amount < 0 ? -Math.min(-amount, balance) : amount;
  const balanceAfter = balance + applied;

  await db.user.update({ where: { id: userId }, data: { virtualPoints: balanceAfter } });
  await db.walletTransaction.create({
    data: {
      userId,
      amount: applied,
      balanceAfter,
      kind,
      note,
      matchId: refs.matchId ?? null,
      betId: refs.betId ?? null,
    },
  });
  return balanceAfter;
}
