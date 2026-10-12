-- Automatic Player of the Match (performance-based), player profile photos
-- and the player complaints box.

-- Player profile photo (data URL, resized client-side before upload)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

-- Auto MOTM stored on the match so it can be backfilled for older games
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "motmUserId" TEXT;
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "motmScore" INTEGER;
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "motmComputedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Match_motmUserId_idx" ON "Match"("motmUserId");
DO $$ BEGIN
  ALTER TABLE "Match" ADD CONSTRAINT "Match_motmUserId_fkey"
    FOREIGN KEY ("motmUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Complaints box
CREATE TYPE "ComplaintType" AS ENUM ('MATCH_DECISION', 'PLAYER_CONDUCT', 'TECHNICAL', 'OTHER');
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

CREATE TABLE IF NOT EXISTS "Complaint" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ComplaintType" NOT NULL,
    "matchId" TEXT,
    "subject" VARCHAR(120) NOT NULL,
    "message" VARCHAR(2000) NOT NULL,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "adminNote" VARCHAR(1000),
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Complaint_status_createdAt_idx" ON "Complaint"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Complaint_userId_createdAt_idx" ON "Complaint"("userId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_matchId_fkey"
    FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_resolvedBy_fkey"
    FOREIGN KEY ("resolvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
