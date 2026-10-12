/**
 * One-off backfill: compute the automatic Player of the Match for every
 * finished match that doesn't have one stored yet. Idempotent — safe to
 * re-run. Run with: npm run motm:backfill
 */
import { backfillMotm } from "../src/lib/match/motm";
import { prisma } from "../src/lib/prisma";

async function main() {
  const pending = await prisma.match.count({ where: { status: "FINISHED", motmComputedAt: null } });
  console.log(`Finished matches without an automatic MOTM: ${pending}`);
  const filled = await backfillMotm();
  console.log(`Backfilled MOTM for ${filled} match(es).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
