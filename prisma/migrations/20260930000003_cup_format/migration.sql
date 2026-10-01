-- AlterTable
ALTER TABLE "Competition" ADD COLUMN     "legsPerTie" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "thirdPlace" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "cupTie" TEXT,
ADD COLUMN     "cupLeg" INTEGER,
ADD COLUMN     "cupThirdPlace" BOOLEAN NOT NULL DEFAULT false;
