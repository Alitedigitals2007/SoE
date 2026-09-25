-- ============================================================================
-- Baseline sync — brings prisma/migrations level with schema.prisma.
--
-- Everything below previously only existed in the loose schema_upgrade*.sql
-- scripts at the repo root, so a database created from `prisma migrate deploy`
-- was missing it. The missing objects are exactly why admin result saving
-- failed: both admin save paths write a TimelineType.ADMIN_OVERRIDE event and
-- read the Bet table inside one transaction (src/lib/match/engine.ts).
--
-- EVERY statement is idempotent:
--   * safe on databases that already ran schema_upgrade*.sql (all no-ops)
--   * safe on fresh databases created from the migration history
-- Run it with `npx prisma migrate deploy`, or by hand with psql.
-- ============================================================================

-- 1) Enum values that were never part of the migration history ---------------
ALTER TYPE "TimelineType" ADD VALUE IF NOT EXISTS 'HALF_TIME';
ALTER TYPE "TimelineType" ADD VALUE IF NOT EXISTS 'ADMIN_OVERRIDE';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WalletTxnKind') THEN
    CREATE TYPE "WalletTxnKind" AS ENUM (
      'WELCOME', 'BET_PLACED', 'BET_WON', 'BET_LOST', 'BET_VOID',
      'FANTASY_GOAL', 'DAILY_CLAIM', 'ADMIN_ADJUST'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BetMarket') THEN
    CREATE TYPE "BetMarket" AS ENUM (
      'MATCH_RESULT', 'EXACT_SCORE', 'TOTAL_GOALS', 'BOTH_TEAMS_TO_SCORE', 'ACCA'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BetStatus') THEN
    CREATE TYPE "BetStatus" AS ENUM ('PENDING', 'WON', 'LOST', 'VOID');
  END IF;
END $$;

-- (WalletTxnKind / BetMarket are created above with their full value set, so
--  no ALTER TYPE ... ADD VALUE is needed for them.)

-- 2) Columns that were only in schema_upgrade2/3/4/6/7/9 ---------------------
ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "TeamPlayer" ADD COLUMN IF NOT EXISTS "isCaptain" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "pausedAt" TIMESTAMP(3);
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "statusNote" TEXT;
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "potmClosedAt" TIMESTAMP(3);

ALTER TABLE "Round" ADD COLUMN IF NOT EXISTS "assistPlayerId" TEXT;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "virtualPoints" INTEGER;

ALTER TABLE "Competition" ADD COLUMN IF NOT EXISTS "countdownSecs" INTEGER;
ALTER TABLE "Competition" ADD COLUMN IF NOT EXISTS "groupsCount" INTEGER;
ALTER TABLE "Competition" ADD COLUMN IF NOT EXISTS "roundsCount" INTEGER;
ALTER TABLE "Competition" ADD COLUMN IF NOT EXISTS "teamsPerGroup" INTEGER;
ALTER TABLE "Competition" ADD COLUMN IF NOT EXISTS "topAdvancing" INTEGER;

-- 3) News (upgrade2) --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "NewsPost" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "authorId" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NewsPost_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "NewsPost_slug_key" ON "NewsPost"("slug");
CREATE INDEX IF NOT EXISTS "NewsPost_published_createdAt_idx" ON "NewsPost"("published", "createdAt");
CREATE INDEX IF NOT EXISTS "NewsPost_slug_idx" ON "NewsPost"("slug");

-- 4) News comments + notifications (upgrade5) --------------------------------
CREATE TABLE IF NOT EXISTS "NewsComment" (
    "id" TEXT NOT NULL,
    "newsId" TEXT NOT NULL,
    "userId" TEXT,
    "guestName" TEXT,
    "content" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NewsComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "NewsComment_newsId_createdAt_idx" ON "NewsComment"("newsId", "createdAt");

CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- 5) Wallet + bets (upgrade9/10) ---------------------------------------------
CREATE TABLE IF NOT EXISTS "WalletTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "kind" "WalletTxnKind" NOT NULL,
    "note" TEXT NOT NULL,
    "matchId" TEXT,
    "betId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WalletTransaction_userId_createdAt_idx" ON "WalletTransaction"("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "Bet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "market" "BetMarket" NOT NULL,
    "selection" TEXT NOT NULL,
    "odds" DECIMAL(5,2) NOT NULL,
    "stake" INTEGER NOT NULL,
    "potentialReturn" INTEGER NOT NULL,
    "status" "BetStatus" NOT NULL DEFAULT 'PENDING',
    "payout" INTEGER NOT NULL DEFAULT 0,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),
    "legs" JSONB,
    "legMatchIds" TEXT[] NOT NULL DEFAULT '{}',
    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Bet_userId_placedAt_idx" ON "Bet"("userId", "placedAt");
CREATE INDEX IF NOT EXISTS "Bet_matchId_status_idx" ON "Bet"("matchId", "status");

-- 6) Foreign keys (only added when missing) ----------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NewsPost_authorId_fkey') THEN
    ALTER TABLE "NewsPost" ADD CONSTRAINT "NewsPost_authorId_fkey"
      FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NewsComment_newsId_fkey') THEN
    ALTER TABLE "NewsComment" ADD CONSTRAINT "NewsComment_newsId_fkey"
      FOREIGN KEY ("newsId") REFERENCES "NewsPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NewsComment_userId_fkey') THEN
    ALTER TABLE "NewsComment" ADD CONSTRAINT "NewsComment_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Notification_userId_fkey') THEN
    ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WalletTransaction_userId_fkey') THEN
    ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Bet_userId_fkey') THEN
    ALTER TABLE "Bet" ADD CONSTRAINT "Bet_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Bet_matchId_fkey') THEN
    ALTER TABLE "Bet" ADD CONSTRAINT "Bet_matchId_fkey"
      FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Round_assistPlayerId_fkey') THEN
    ALTER TABLE "Round" ADD CONSTRAINT "Round_assistPlayerId_fkey"
      FOREIGN KEY ("assistPlayerId") REFERENCES "MatchPlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
