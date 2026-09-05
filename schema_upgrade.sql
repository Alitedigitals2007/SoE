-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CompetitionType" ADD VALUE 'LEAGUE_CUP';
ALTER TYPE "CompetitionType" ADD VALUE 'CUSTOM';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TimelineType" ADD VALUE 'PENALTY_SAVED';
ALTER TYPE "TimelineType" ADD VALUE 'PENALTY_SCORED';
ALTER TYPE "TimelineType" ADD VALUE 'PENALTY_MISS';
ALTER TYPE "TimelineType" ADD VALUE 'PENALTY_SHOOTOUT_START';
ALTER TYPE "TimelineType" ADD VALUE 'PENALTY_SHOOTOUT_END';

-- AlterTable
ALTER TABLE "Competition" ADD COLUMN     "countdownSecs" INTEGER,
ADD COLUMN     "groupsCount" INTEGER,
ADD COLUMN     "roundsCount" INTEGER,
ADD COLUMN     "teamsPerGroup" INTEGER,
ADD COLUMN     "topAdvancing" INTEGER;

-- CreateTable
CREATE TABLE "PenaltyShootout" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "teamAScore" INTEGER NOT NULL DEFAULT 0,
    "teamBScore" INTEGER NOT NULL DEFAULT 0,
    "winner" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PenaltyShootout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PenaltyKick" (
    "id" TEXT NOT NULL,
    "shootoutId" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "score" BOOLEAN NOT NULL,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PenaltyKick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PotmVote" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PotmVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PenaltyShootout_matchId_key" ON "PenaltyShootout"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "PenaltyKick_shootoutId_sequence_key" ON "PenaltyKick"("shootoutId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "PotmVote_matchId_userId_key" ON "PotmVote"("matchId", "userId");

-- CreateIndex
CREATE INDEX "ChatMessage_matchId_createdAt_idx" ON "ChatMessage"("matchId", "createdAt");

-- AddForeignKey
ALTER TABLE "PenaltyShootout" ADD CONSTRAINT "PenaltyShootout_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenaltyKick" ADD CONSTRAINT "PenaltyKick_shootoutId_fkey" FOREIGN KEY ("shootoutId") REFERENCES "PenaltyShootout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PotmVote" ADD CONSTRAINT "PotmVote_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PotmVote" ADD CONSTRAINT "PotmVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PotmVote" ADD CONSTRAINT "PotmVote_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
