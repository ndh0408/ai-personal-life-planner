/**
 * Foundation seed — intentionally minimal.
 * Adds nothing in production; later rounds extend per feature table.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.log('[seed] skipping in production');
    return;
  }
  console.log('[seed] foundation round — no seed data yet');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
