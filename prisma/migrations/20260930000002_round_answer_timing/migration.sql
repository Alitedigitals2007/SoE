-- Round.inputOpensAt: the answer box unlock time, split from openedAt (read time).
-- Round.struckSubmissionIds: submissions struck by an upheld integrity flag.
-- Both guarded so the migration is safe to re-run against a drifted database.

ALTER TABLE "Round" ADD COLUMN IF NOT EXISTS "inputOpensAt" TIMESTAMP(3);

ALTER TABLE "Round"
  ADD COLUMN IF NOT EXISTS "struckSubmissionIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Index created by 20260929000000_match_integrity; declared in the schema now.
CREATE INDEX IF NOT EXISTS "Submission_playerId_pasted_idx" ON "Submission"("playerId", "pasted");
