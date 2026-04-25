/**
 * scripts/seed-load-test.ts — provision N synthetic users for the k6
 * scenarios in tests/load/.
 *
 * Run:
 *   cd apps/api && npx ts-node ../../scripts/seed-load-test.ts \
 *     --count 50 --password 'LoadTest!1' --prefix loadtest+ --domain lifeos.local
 *
 * Each user gets:
 *   - bcrypt-hashed password (cost 4 — load-test users only)
 *   - profile (timezone Asia/Ho_Chi_Minh, locale vi)
 *   - 1 wallet (VND) with opening balance 1,000,000
 *   - notification setting (assistantNudge=true)
 *   - widget preferences row
 *   - AI usage quota with elevated chat cap so quota-load can drive it
 *
 * REFUSES to run against `process.env.NODE_ENV === 'production'` unless
 * `ALLOW_LOAD_SEED_IN_PRODUCTION=true` is also set.
 *
 * REFUSES to run against a `DATABASE_URL` containing /prod|production|live/.
 *
 * Idempotent: re-running skips existing users (matched by email).
 */
import { PrismaClient, WalletType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

type Args = {
  count: number;
  password: string;
  prefix: string;
  domain: string;
};

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--count') args.count = Number(argv[++i]);
    else if (a === '--password') args.password = argv[++i];
    else if (a === '--prefix') args.prefix = argv[++i];
    else if (a === '--domain') args.domain = argv[++i];
  }
  return {
    count: args.count ?? 50,
    password: args.password ?? 'LoadTest!1',
    prefix: args.prefix ?? 'loadtest+',
    domain: args.domain ?? 'lifeos.local',
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.DATABASE_URL ?? '';
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_LOAD_SEED_IN_PRODUCTION !== 'true'
  ) {
    console.error('[load-seed] refusing to seed in production. Set ALLOW_LOAD_SEED_IN_PRODUCTION=true to override.');
    process.exit(2);
  }
  if (/prod|production|live/i.test(url)) {
    console.error('[load-seed] DATABASE_URL looks like production. Refusing to seed.');
    process.exit(2);
  }
  if (!args.password || args.password.length < 8) {
    console.error('[load-seed] --password must be at least 8 chars.');
    process.exit(2);
  }
  if (args.count < 1 || args.count > 10_000) {
    console.error('[load-seed] --count must be between 1 and 10000.');
    process.exit(2);
  }

  const prisma = new PrismaClient();
  // bcrypt cost 4 is fine for load-test users — they exist only in
  // staging and are GDPR-purgeable via the round-18 admin endpoint.
  const passwordHash = await bcrypt.hash(args.password, 4);
  let created = 0;
  let skipped = 0;
  for (let i = 1; i <= args.count; i++) {
    const email = `${args.prefix}${i}@${args.domain}`;
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      skipped++;
      continue;
    }
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: `Load Test ${i}`,
        emailVerifiedAt: new Date(), // skip verification gates in load tests
        profile: {
          create: {
            fullName: `Load Test ${i}`,
            timezone: 'Asia/Ho_Chi_Minh',
            locale: 'vi',
            currency: 'VND',
          },
        },
        wallets: {
          create: [
            {
              name: 'Cash',
              type: WalletType.CASH,
              balance: 1_000_000,
              currency: 'VND',
            },
          ],
        },
        notificationSetting: { create: { assistantNudge: true } },
        widgetPreferences: { create: {} },
        aiUsageQuota: {
          // Elevated cap so the quota-load scenario can push limits without
          // each user immediately running out.
          create: { dailyChatLimit: 100, dailyScheduleLimit: 50 },
        },
      },
    });
    created++;
    if (created % 25 === 0) {
      console.log(`[load-seed] created ${created} users so far (latest: ${user.id})`);
    }
  }
  console.log(`[load-seed] done. created=${created} skipped=${skipped} total=${args.count}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('[load-seed] failed', e);
  process.exit(1);
});
