-- Migration: add TransferRequest model (captain-initiated player transfers)
-- Run this against your PostgreSQL database if you are not using `prisma migrate`.

-- 1. Enum type for the transfer request status
CREATE TYPE "TransferRequestStatus" AS ENUM (
    'PENDING',
    'ADMIN_APPROVED',
    'PLAYER_ACCEPTED',
    'REJECTED',
    'CANCELLED'
);

-- 2. TransferRequest table
CREATE TABLE "TransferRequest" (
    "id" TEXT NOT NULL,
    "captainId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "fromTeamId" TEXT NOT NULL,
    "toTeamId" TEXT NOT NULL,
    "status" "TransferRequestStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" VARCHAR(1000),
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferRequest_pkey" PRIMARY KEY ("id"),

    CONSTRAINT "TransferRequest_captainId_fkey"
        FOREIGN KEY ("captainId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT "TransferRequest_playerId_fkey"
        FOREIGN KEY ("playerId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT "TransferRequest_fromTeamId_fkey"
        FOREIGN KEY ("fromTeamId") REFERENCES "Team"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT "TransferRequest_toTeamId_fkey"
        FOREIGN KEY ("toTeamId") REFERENCES "Team"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT "TransferRequest_decidedBy_fkey"
        FOREIGN KEY ("decidedBy") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

-- 3. Indexes (matching the Prisma @@index declarations)
CREATE INDEX "TransferRequest_captainId_status_idx"
    ON "TransferRequest"("captainId", "status");

CREATE INDEX "TransferRequest_playerId_status_idx"
    ON "TransferRequest"("playerId", "status");

CREATE INDEX "TransferRequest_status_idx"
    ON "TransferRequest"("status");

-- 4. Prisma needs to know the migration was applied.
-- If you are using Prisma Migrate, record this migration so future `prisma migrate diff`
-- and `prisma migrate deploy` stay in sync:
--   INSERT INTO "_prisma_migrations" (...) VALUES (...)
-- Otherwise, just ensure your schema.prisma matches this SQL before deploying.
