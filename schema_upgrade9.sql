-- ============================================================================
-- SoE upgrade 9 — virtual-points betting (wallet + bet ledger + bets)
--
-- ⚠️ Run this file OUTSIDE a transaction (psql runs statements one-by-one by
--    default; in psql do NOT wrap it in BEGIN/COMMIT, and do not paste it
--    into a tool that auto-wraps multi-statement scripts in a transaction,
--    because CREATE TYPE / ALTER TYPE cannot run inside one in older Postgres).
--
-- After running it, restart the app (Prisma client must be regenerated on
-- deploy: `npx prisma generate` — Vercel does this automatically).
-- ============================================================================

-- Wallet ledger kinds ---------------------------------------------------------
CREATE TYPE "WalletTxnKind" AS ENUM (
  'WELCOME',       -- +100 bonus when the wallet is first opened
  'BET_PLACED',    -- stake debit
  'BET_WON',       -- stake returned + winnings
  'BET_LOST',      -- result record (amount 0 — the stake was debited on placement)
  'BET_VOID',      -- stake refunded
  'FANTASY_GOAL'   -- +10 for each goal by a fantasy-picked scorer
);

-- Bet markets / statuses ------------------------------------------------------
CREATE TYPE "BetMarket" AS ENUM ('MATCH_RESULT', 'EXACT_SCORE');
CREATE TYPE "BetStatus" AS ENUM ('PENDING', 'WON', 'LOST', 'VOID');

-- User wallet balance (NULL = wallet not opened yet; first touch credits 100) --
ALTER TABLE "User" ADD COLUMN "virtualPoints" INTEGER;

-- Wallet transaction ledger ---------------------------------------------------
CREATE TABLE "WalletTransaction" (
  "id"           TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "amount"       INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL,
  "kind"         "WalletTxnKind" NOT NULL,
  "note"         TEXT NOT NULL,
  "matchId"      TEXT,
  "betId"        TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WalletTransaction_userId_createdAt_idx" ON "WalletTransaction"("userId", "createdAt");

ALTER TABLE "WalletTransaction"
  ADD CONSTRAINT "WalletTransaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bets -------------------------------------------------------------------------
CREATE TABLE "Bet" (
  "id"              TEXT NOT NULL,
  "userId"          TEXT NOT NULL,
  "matchId"         TEXT NOT NULL,
  "market"          "BetMarket" NOT NULL,
  "selection"       TEXT NOT NULL,
  "odds"            DECIMAL(5,2) NOT NULL,
  "stake"           INTEGER NOT NULL,
  "potentialReturn" INTEGER NOT NULL,
  "status"          "BetStatus" NOT NULL DEFAULT 'PENDING',
  "payout"          INTEGER NOT NULL DEFAULT 0,
  "placedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "settledAt"       TIMESTAMP(3),

  CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Bet_userId_placedAt_idx" ON "Bet"("userId", "placedAt");
CREATE INDEX "Bet_matchId_status_idx" ON "Bet"("matchId", "status");

ALTER TABLE "Bet"
  ADD CONSTRAINT "Bet_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Bet"
  ADD CONSTRAINT "Bet_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Done. Existing users get their 100 welcome points automatically the first
-- time they open the Bet page or place a bet.
