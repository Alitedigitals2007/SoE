-- Migration: add TransferWindow + TransferListing (admin-managed transfer windows)
--
-- Idempotent on purpose: databases that got these objects through `prisma db push`
-- (or a partially applied earlier attempt) already have the enum types/tables, so
-- every statement is guarded and safe to re-run.

-- 1. Enum types (PostgreSQL has no CREATE TYPE IF NOT EXISTS, so guard with a DO block)
DO $$ BEGIN
    CREATE TYPE "TransferWindowStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "TransferListingStatus" AS ENUM ('LISTED', 'SOLD', 'WITHDRAWN');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2. TransferWindow table
CREATE TABLE IF NOT EXISTS "TransferWindow" (
    "id" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TransferWindowStatus" NOT NULL DEFAULT 'DRAFT',
    "openAt" TIMESTAMP(3),
    "closeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferWindow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TransferWindow_status_idx" ON "TransferWindow"("status");
CREATE INDEX IF NOT EXISTS "TransferWindow_season_idx" ON "TransferWindow"("season");

-- 3. TransferListing table
CREATE TABLE IF NOT EXISTS "TransferListing" (
    "id" TEXT NOT NULL,
    "windowId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "askingPrice" INTEGER NOT NULL,
    "status" "TransferListingStatus" NOT NULL DEFAULT 'LISTED',
    "buyerId" TEXT,
    "soldAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferListing_pkey" PRIMARY KEY ("id"),

    CONSTRAINT "TransferListing_windowId_fkey"
        FOREIGN KEY ("windowId") REFERENCES "TransferWindow"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT "TransferListing_playerId_fkey"
        FOREIGN KEY ("playerId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT "TransferListing_teamId_fkey"
        FOREIGN KEY ("teamId") REFERENCES "Team"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT "TransferListing_buyerId_fkey"
        FOREIGN KEY ("buyerId") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "TransferListing_windowId_status_idx" ON "TransferListing"("windowId", "status");
CREATE INDEX IF NOT EXISTS "TransferListing_playerId_idx" ON "TransferListing"("playerId");
CREATE INDEX IF NOT EXISTS "TransferListing_teamId_status_idx" ON "TransferListing"("teamId", "status");
