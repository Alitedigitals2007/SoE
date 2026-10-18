-- Migration: record which action a CARD timeline event represents
--
-- The match timeline previously rendered every CARD event with the same icon,
-- so a warning, a yellow card and a red card all looked identical. The event
-- now carries the incident action so the UI can colour each one correctly.
--
-- Idempotent on purpose: guarded column add, then a one-time backfill of
-- existing card events from their labels, which the engine writes in the
-- form "<Action> — <Player>".

ALTER TABLE "TimelineEvent" ADD COLUMN IF NOT EXISTS "cardAction" "IncidentAction";

UPDATE "TimelineEvent"
SET "cardAction" = CASE
    WHEN "label" LIKE 'Red Card — %' THEN 'RED_CARD'::"IncidentAction"
    WHEN "label" LIKE 'Yellow Card — %' THEN 'YELLOW_CARD'::"IncidentAction"
    WHEN "label" LIKE 'Warning — %' THEN 'WARNING'::"IncidentAction"
    ELSE NULL
END
WHERE "type" = 'CARD'
  AND "cardAction" IS NULL;
