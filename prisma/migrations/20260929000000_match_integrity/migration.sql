-- Match integrity: anti-copy enforcement for live play.
-- Idempotent: safe to run on a database that already has these objects.

-- New incident categories for the referee's book.
DO $$ BEGIN
  ALTER TYPE "IncidentType" ADD VALUE IF NOT EXISTS 'COPIED_ANSWER';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE "IncidentType" ADD VALUE IF NOT EXISTS 'LEFT_FULLSCREEN';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE "IncidentType" ADD VALUE IF NOT EXISTS 'AI_ASSISTANCE';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Public timeline event when a breach is raised.
DO $$ BEGIN
  ALTER TYPE "TimelineType" ADD VALUE IF NOT EXISTS 'INTEGRITY_FLAG';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Per-submission forensic detail, captured at submit time.
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "pasted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "typingMs" INTEGER;
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "charCount" INTEGER;

-- The breach log itself.
DO $$ BEGIN
  CREATE TYPE "IntegrityFlagKind" AS ENUM ('COPIED_ANSWER', 'COPIED_CONTENT', 'LEFT_FULLSCREEN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "IntegrityFlag" (
  "id"            TEXT NOT NULL,
  "matchId"       TEXT NOT NULL,
  "playerId"      TEXT NOT NULL,
  "roundId"       TEXT,
  "submissionId"  TEXT,
  "kind"          "IntegrityFlagKind" NOT NULL,
  "detail"        TEXT,
  "seq"           INTEGER NOT NULL,
  "suggested"     "IncidentAction" NOT NULL DEFAULT 'WARNING',
  "action"        "IncidentAction",
  "issuedById"    TEXT,
  "issuedAt"      TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrityFlag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IntegrityFlag_playerId_seq_key" ON "IntegrityFlag"("playerId", "seq");
CREATE INDEX IF NOT EXISTS "IntegrityFlag_matchId_createdAt_idx" ON "IntegrityFlag"("matchId", "createdAt");
CREATE INDEX IF NOT EXISTS "IntegrityFlag_matchId_action_idx" ON "IntegrityFlag"("matchId", "action");

DO $$ BEGIN
  ALTER TABLE "IntegrityFlag" ADD CONSTRAINT "IntegrityFlag_matchId_fkey"
    FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "IntegrityFlag" ADD CONSTRAINT "IntegrityFlag_playerId_fkey"
    FOREIGN KEY ("playerId") REFERENCES "MatchPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "IntegrityFlag" ADD CONSTRAINT "IntegrityFlag_roundId_fkey"
    FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "IntegrityFlag" ADD CONSTRAINT "IntegrityFlag_submissionId_fkey"
    FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Speeds up the referee's board.
CREATE INDEX IF NOT EXISTS "Submission_playerId_pasted_idx" ON "Submission"("playerId", "pasted");
