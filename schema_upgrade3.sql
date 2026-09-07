-- Scheduled kick-off for matches (picked in Nigeria time / Africa/Lagos)
ALTER TABLE "Match" ADD COLUMN "scheduledAt" TIMESTAMP(3);
