-- Assists: credit a second player on a goal round
ALTER TABLE "Round" ADD COLUMN IF NOT EXISTS "assistPlayerId" TEXT;

ALTER TABLE "Round" DROP CONSTRAINT IF EXISTS "Round_assistPlayerId_fkey";
ALTER TABLE "Round" ADD CONSTRAINT "Round_assistPlayerId_fkey" FOREIGN KEY ("assistPlayerId") REFERENCES "MatchPlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
