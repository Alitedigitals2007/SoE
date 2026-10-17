/**
 * Marks Prisma migrations that failed mid-deploy as rolled back so the next
 * `prisma migrate deploy` retries them.
 *
 * Why this exists: when a migration fails, Prisma records it in
 * `_prisma_migrations` and refuses to apply anything else until it is
 * resolved. On Vercel there is no terminal to run `prisma migrate resolve`,
 * so this runs before `migrate deploy` on every build. It is safe to run
 * repeatedly, and it never exits non-zero — if the database is unreachable,
 * `prisma migrate deploy` that follows will surface the real error.
 *
 * Pair this with idempotent migration SQL (guarded CREATE TYPE/CREATE TABLE
 * IF NOT EXISTS) so a retried migration does not fail on objects that were
 * already created by an earlier partial attempt or by `prisma db push`.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  let failed = [];
  try {
    failed = await prisma.$queryRaw`
      SELECT migration_name
      FROM "_prisma_migrations"
      WHERE finished_at IS NULL AND rolled_back_at IS NULL
      ORDER BY started_at ASC
    `;
  } catch (error) {
    const message = String(error?.message ?? error);
    if (error?.code === "P2010" || message.includes("42P01")) {
      console.log("No _prisma_migrations table yet — nothing to resolve.");
      return;
    }
    throw error;
  }

  if (failed.length === 0) {
    console.log("No failed migrations found.");
    return;
  }

  for (const row of failed) {
    await prisma.$executeRaw`
      UPDATE "_prisma_migrations"
      SET rolled_back_at = NOW()
      WHERE migration_name = ${row.migration_name}
        AND finished_at IS NULL
        AND rolled_back_at IS NULL
    `;
    console.log(`Marked failed migration as rolled back: ${row.migration_name}`);
  }
}

main()
  .catch((error) => {
    console.warn("Could not resolve failed migrations:", error?.message ?? error);
  })
  .finally(() => prisma.$disconnect());
