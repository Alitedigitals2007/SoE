-- New betting markets: double chance, draw-no-bet, half-time result,
-- half-time/full-time and per-team totals.
ALTER TYPE "BetMarket" ADD VALUE IF NOT EXISTS 'DOUBLE_CHANCE';
ALTER TYPE "BetMarket" ADD VALUE IF NOT EXISTS 'DRAW_NO_BET';
ALTER TYPE "BetMarket" ADD VALUE IF NOT EXISTS 'HALF_RESULT';
ALTER TYPE "BetMarket" ADD VALUE IF NOT EXISTS 'HALF_FULL';
ALTER TYPE "BetMarket" ADD VALUE IF NOT EXISTS 'TEAM_TOTALS';
