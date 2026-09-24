-- ============================================================================
-- SoE upgrade 9 — virtual-points betting (wallet + bet ledger + bets)
--
-- ⚠️ Run this file OUTSIDE a transaction (psql runs statements one-by-one by
--    default; do NOT wrap it in BEGIN/COMMIT, and do not paste it into a tool
--    that auto-wraps multi-statement scripts — CREATE TYPE / ALTER TYPE cannot
--    safely run inside one).
--
-- This is the CONSOLIDATED version (includes the totals/BTTS/accumulator
-- markets, daily claim & admin-adjust wallet kinds, and Bet.legs columns).
--
--   • If you have NEVER run an upgrade9 before → run THIS file only.
--   • If you already ran the earlier upgrade9 → run schema_upgrade10.sql
--     instead (this file's CREATE TYPE statements will fail on re-run).
--
-- After running, restart/redeploy the app (Vercel runs `prisma generate`).
-- ============================================================================

-- Wallet ledger kinds ---------------------------------------------------------
CREATE TYPE "WalletTxnKind" AS ENUM (
  'WELCOME',       -- +100 bonus when the wallet is first opened
  'BET_PLACED',    -- stake debit
  'BET_WON',       -- stake returned + winnings
  'BET_LOST',      -- result record (amount 0 — the stake was debited on placement)
  'BET_VOID',      -- stake refunded
  'FANTASY_GOAL',  -- +10 for each goal by a fantasy-picked scorer
  'DAILY_CLAIM',   -- +20 once per day
  'ADMIN_ADJUST'   -- admin manual credit/debit
);

-- Bet markets / statuses ------------------------------------------------------
CREATE TYPE "BetMarket" AS ENUM (
  'MATCH_RESULT',
  'EXACT_SCORE',
  'TOTAL_GOALS',
  'BOTH_TEAMS_TO_SCORE',
  'ACCA'
);
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
  "legs"            JSONB,
  "legMatchIds"     TEXT[] NOT NULL DEFAULT '{}',

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
