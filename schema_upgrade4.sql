-- Pause / half-time / postpone state + a HALF_TIME timeline event type
ALTER TYPE "TimelineType" ADD VALUE IF NOT EXISTS 'HALF_TIME';
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "pausedAt" TIMESTAMP(3);
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "statusNote" TEXT;
