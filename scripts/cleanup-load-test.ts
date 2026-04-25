/**
 * scripts/cleanup-load-test.ts — purge load-test users + their owned data.
 *
 * Run:
 *   cd apps/api && npx ts-node ../../scripts/cleanup-load-test.ts \
 *     --prefix loadtest+ --domain lifeos.local --confirm I-AM-IN-STAGING
 *
 * Safeguards:
 *   - REFUSES production NODE_ENV (and any DATABASE_URL containing
 *     /prod|production|live/).
 *   - REFUSES without --confirm I-AM-IN-STAGING (so a typo on the prefix
 *     can't wipe a real user's data — even though the unique-prefix filter
 *     already protects that).
 *
 * Cleanup uses Prisma's onDelete: Cascade from User down to every owned
 * row (wallets, expenses, tasks, AI memory, audit logs, etc), which is
 * the same path GDPR purge uses in round 18.
 */
import { PrismaClient } from '@prisma/client';

function parseArgs(argv: string[]): { prefix: string; domain: string; confirm: string } {
  const out = { prefix: 'loadtest+', domain: 'lifeos.local', confirm: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--prefix') out.prefix = argv[++i];
    else if (a === '--domain') out.domain = argv[++i];
    else if (a === '--confirm') out.confirm = argv[++i];
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.DATABASE_URL ?? '';
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_LOAD_CLEANUP_IN_PRODUCTION !== 'true'
  ) {
    console.error('[load-cleanup] refusing in production. Set ALLOW_LOAD_CLEANUP_IN_PRODUCTION=true to override.');
    process.exit(2);
  }
  if (/prod|production|live/i.test(url)) {
    console.error('[load-cleanup] DATABASE_URL looks like production. Refusing.');
    process.exit(2);
  }
  if (args.confirm !== 'I-AM-IN-STAGING') {
    console.error('[load-cleanup] missing --confirm I-AM-IN-STAGING (literal).');
    process.exit(2);
  }

  const prisma = new PrismaClient();
  // Match by both prefix AND domain so a typo can't widen the blast radius.
  const where = {
    AND: [
      { email: { startsWith: args.prefix } },
      { email: { endsWith: `@${args.domain}` } },
    ],
  };
  const total = await prisma.user.count({ where });
  console.log(`[load-cleanup] ${total} matching user(s) under prefix='${args.prefix}' domain='${args.domain}'`);
  if (total === 0) {
    await prisma.$disconnect();
    return;
  }
  // Cascade does the rest. We chunk so a giant load-seed doesn't blow up
  // the connection pool with a single huge transaction.
  let deleted = 0;
  while (true) {
    const batch = await prisma.user.findMany({
      where,
      select: { id: true },
      take: 100,
    });
    if (batch.length === 0) break;
    for (const u of batch) {
      await prisma.user.delete({ where: { id: u.id } });
      deleted++;
    }
    console.log(`[load-cleanup] deleted ${deleted}/${total}`);
  }
  console.log('[load-cleanup] done.');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('[load-cleanup] failed', e);
  process.exit(1);
});
