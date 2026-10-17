-- Stadium of Elite — Transfer window & player market value migration
-- Consolidates all transfer-related schema changes into a single file.

-- -------------------------------------------------------
-- 1. Enums
-- -------------------------------------------------------

CREATE TYPE "TransferWindowStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');
CREATE TYPE "TransferListingStatus" AS ENUM ('LISTED', 'SOLD', 'WITHDRAWN');

-- -------------------------------------------------------
-- 2. User: add market value (virtual points, separate from wallet)
-- -------------------------------------------------------

ALTER TABLE "User" ADD COLUMN "marketValue" INTEGER NOT NULL DEFAULT 0;

-- -------------------------------------------------------
-- 3. TransferWindow
-- -------------------------------------------------------

CREATE TABLE "TransferWindow" (
    "id" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TransferWindowStatus" NOT NULL DEFAULT 'DRAFT',
    "openAt" TIMESTAMP(3),
    "closeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferWindow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TransferWindow_status_idx" ON "TransferWindow"("status");
CREATE INDEX "TransferWindow_season_idx" ON "TransferWindow"("season");

-- -------------------------------------------------------
-- 4. TransferListing
-- -------------------------------------------------------

CREATE TABLE "TransferListing" (
    "id" TEXT NOT NULL,
    "windowId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "askingPrice" INTEGER NOT NULL,
    "status" "TransferListingStatus" NOT NULL DEFAULT 'LISTED',
    "buyerId" TEXT,
    "soldAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferListing_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TransferListing_windowId_status_idx" ON "TransferListing"("windowId", "status");
CREATE INDEX "TransferListing_playerId_idx" ON "TransferListing"("playerId");
CREATE INDEX "TransferListing_teamId_status_idx" ON "TransferListing"("teamId", "status");

-- -------------------------------------------------------
-- 5. Foreign keys
-- -------------------------------------------------------

ALTER TABLE "TransferListing"
    ADD CONSTRAINT "TransferListing_windowId_fkey"
    FOREIGN KEY ("windowId") REFERENCES "TransferWindow"("id") ON DELETE CASCADE;

ALTER TABLE "TransferListing"
    ADD CONSTRAINT "TransferListing_playerId_fkey"
    FOREIGN KEY ("playerId") REFERENCES "User"("id") ON DELETE CASCADE;

ALTER TABLE "TransferListing"
    ADD CONSTRAINT "TransferListing_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE;

ALTER TABLE "TransferListing"
    ADD CONSTRAINT "TransferListing_buyerId_fkey"
    FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE SET NULL;
