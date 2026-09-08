-- Timed Player-of-the-Match voting window close flag
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "potmClosedAt" TIMESTAMP(3);
