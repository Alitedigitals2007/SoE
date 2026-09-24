-- ============================================================================
-- SoE upgrade 10 — delta for databases that ALREADY ran the first upgrade9
--
-- ⚠️ Run OUTSIDE a transaction (ALTER TYPE ... ADD VALUE cannot be used in the
--    same transaction that adds it; keep it standalone).
--
-- If you have NOT run schema_upgrade9.sql yet, STOP: run the current (updated)
-- schema_upgrade9.sql instead — it already contains everything below.
--
-- Adds:
--   • BetMarket: TOTAL_GOALS, BOTH_TEAMS_TO_SCORE, ACCA
--   • WalletTxnKind: DAILY_CLAIM, ADMIN_ADJUST
--   • Bet.legs (JSONB) + Bet.legMatchIds (TEXT[]) for accumulators
-- ============================================================================

ALTER TYPE "BetMarket" ADD VALUE IF NOT EXISTS 'TOTAL_GOALS';
ALTER TYPE "BetMarket" ADD VALUE IF NOT EXISTS 'BOTH_TEAMS_TO_SCORE';
ALTER TYPE "BetMarket" ADD VALUE IF NOT EXISTS 'ACCA';

ALTER TYPE "WalletTxnKind" ADD VALUE IF NOT EXISTS 'DAILY_CLAIM';
ALTER TYPE "WalletTxnKind" ADD VALUE IF NOT EXISTS 'ADMIN_ADJUST';

ALTER TABLE "Bet" ADD COLUMN IF NOT EXISTS "legs" JSONB;
ALTER TABLE "Bet" ADD COLUMN IF NOT EXISTS "legMatchIds" TEXT[] NOT NULL DEFAULT '{}';
