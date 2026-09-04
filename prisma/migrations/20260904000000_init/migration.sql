-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'REFEREE', 'PLAYER');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('DRAFT', 'LIVE', 'FINISHED');

-- CreateEnum
CREATE TYPE "TeamSide" AS ENUM ('HOME', 'AWAY');

-- CreateEnum
CREATE TYPE "LineupRole" AS ENUM ('STARTER', 'SUB', 'OUT');

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('PENDING', 'OPEN', 'LOCKED', 'DECIDED');

-- CreateEnum
CREATE TYPE "RoundDecision" AS ENUM ('GOAL', 'NO_GOAL');

-- CreateEnum
CREATE TYPE "SubRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('OUTSIDE_TIME', 'ANSWER_MANIPULATION', 'ANSWER_SHARING', 'ABUSIVE_BEHAVIOUR', 'CHAT_SPAM', 'ACCOUNT_MISUSE', 'UNAUTHORIZED_ASSISTANCE', 'DISRESPECT_REFEREE', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentAction" AS ENUM ('WARNING', 'YELLOW_CARD', 'RED_CARD');

-- CreateEnum
CREATE TYPE "TimelineType" AS ENUM ('KICKOFF', 'QUESTION_OPEN', 'ANSWERS_LOCKED', 'GOAL', 'NO_GOAL', 'SUBSTITUTION', 'CARD', 'FULL_TIME');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "homeName" TEXT NOT NULL,
    "awayName" TEXT NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'DRAFT',
    "refereeId" TEXT NOT NULL,
    "countdownSeconds" INTEGER NOT NULL DEFAULT 15,
    "currentRound" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "homeScore" INTEGER NOT NULL DEFAULT 0,
    "awayScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchPlayer" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "team" "TeamSide" NOT NULL,
    "number" INTEGER NOT NULL,
    "isCaptain" BOOLEAN NOT NULL DEFAULT false,
    "role" "LineupRole" NOT NULL DEFAULT 'STARTER',

    CONSTRAINT "MatchPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "referenceAnswer" TEXT NOT NULL,
    "roundNumber" INTEGER,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "questionId" TEXT NOT NULL,
    "status" "RoundStatus" NOT NULL DEFAULT 'PENDING',
    "openedAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "decision" "RoundDecision",
    "goalSubmissionId" TEXT,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubstitutionRequest" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "team" "TeamSide" NOT NULL,
    "playerInId" TEXT NOT NULL,
    "playerOutId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "status" "SubRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "SubstitutionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Substitution" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "team" "TeamSide" NOT NULL,
    "playerInId" TEXT NOT NULL,
    "playerOutId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Substitution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConductIncident" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "type" "IncidentType" NOT NULL,
    "action" "IncidentAction" NOT NULL,
    "note" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConductIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineEvent" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "type" "TimelineType" NOT NULL,
    "roundNumber" INTEGER,
    "label" TEXT NOT NULL,
    "detail" TEXT,
    "authoredById" TEXT,
    "seq" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Match_code_key" ON "Match"("code");

-- CreateIndex
CREATE INDEX "Match_refereeId_idx" ON "Match"("refereeId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchPlayer_matchId_userId_key" ON "MatchPlayer"("matchId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchPlayer_matchId_team_number_key" ON "MatchPlayer"("matchId", "team", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Question_matchId_order_key" ON "Question"("matchId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Question_matchId_roundNumber_key" ON "Question"("matchId", "roundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Round_goalSubmissionId_key" ON "Round"("goalSubmissionId");

-- CreateIndex
CREATE UNIQUE INDEX "Round_matchId_number_key" ON "Round"("matchId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Round_matchId_questionId_key" ON "Round"("matchId", "questionId");

-- CreateIndex
CREATE INDEX "Submission_roundId_seq_idx" ON "Submission"("roundId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_roundId_playerId_key" ON "Submission"("roundId", "playerId");

-- CreateIndex
CREATE INDEX "TimelineEvent_matchId_seq_idx" ON "TimelineEvent"("matchId", "seq");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayer" ADD CONSTRAINT "MatchPlayer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayer" ADD CONSTRAINT "MatchPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_goalSubmissionId_fkey" FOREIGN KEY ("goalSubmissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "MatchPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubstitutionRequest" ADD CONSTRAINT "SubstitutionRequest_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubstitutionRequest" ADD CONSTRAINT "SubstitutionRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Substitution" ADD CONSTRAINT "Substitution_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Substitution" ADD CONSTRAINT "Substitution_playerInId_fkey" FOREIGN KEY ("playerInId") REFERENCES "MatchPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Substitution" ADD CONSTRAINT "Substitution_playerOutId_fkey" FOREIGN KEY ("playerOutId") REFERENCES "MatchPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConductIncident" ADD CONSTRAINT "ConductIncident_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConductIncident" ADD CONSTRAINT "ConductIncident_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "MatchPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_authoredById_fkey" FOREIGN KEY ("authoredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

