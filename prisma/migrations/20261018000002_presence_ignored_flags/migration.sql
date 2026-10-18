-- Migration: match presence + ignored integrity flags
--
-- 1. MatchPresence: one row per (match, user) refreshed by the client
--    heartbeat, so the match page can show who is online per team.
-- 2. IntegrityFlag gains ignoredById/ignoredAt: the referee (or an admin) can
--    wave a breach off — ignored breaches are never counted and never lower
--    the player's integrity score.
--
-- Idempotent on purpose: every object is guarded so a re-run (or a database
-- that got the table via `prisma db push`) does not fail.

-- 1. MatchPresence table
CREATE TABLE IF NOT EXISTS "MatchPresence" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchPresence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MatchPresence_matchId_userId_key" ON "MatchPresence"("matchId", "userId");
CREATE INDEX IF NOT EXISTS "MatchPresence_matchId_lastSeenAt_idx" ON "MatchPresence"("matchId", "lastSeenAt");

DO $$ BEGIN
    ALTER TABLE "MatchPresence" ADD CONSTRAINT "MatchPresence_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "MatchPresence" ADD CONSTRAINT "MatchPresence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2. IntegrityFlag: ignored state
ALTER TABLE "IntegrityFlag" ADD COLUMN IF NOT EXISTS "ignoredById" TEXT;
ALTER TABLE "IntegrityFlag" ADD COLUMN IF NOT EXISTS "ignoredAt" TIMESTAMP(3);
