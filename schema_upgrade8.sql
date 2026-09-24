-- Admin manual overrides: record score/goal edits on the match timeline.
-- Run standalone (not inside a transaction): ALTER TYPE ... ADD VALUE
-- cannot run in a transaction block on PostgreSQL.
ALTER TYPE "TimelineType" ADD VALUE IF NOT EXISTS 'ADMIN_OVERRIDE';
