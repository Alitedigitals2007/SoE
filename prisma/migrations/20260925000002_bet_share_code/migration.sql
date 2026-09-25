-- Public share code for a placed slip (/bet/slip/[code]).
-- Idempotent: safe to run on a database that already has the column.

ALTER TABLE "Bet" ADD COLUMN IF NOT EXISTS "code" TEXT;

-- Backfill rows written before the column existed (random, collision-proof enough).
UPDATE "Bet"
SET "code" = upper(substr(md5(random()::text || "id" || clock_timestamp()), 1, 10))
WHERE "code" IS NULL OR "code" = '';

ALTER TABLE "Bet" ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Bet_code_key" ON "Bet"("code");
