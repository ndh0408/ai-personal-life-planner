/**
 * One-shot smoke test: runs the assistant's monitoring + scoring + sample
 * recommendation creation against the seeded demo user. Run with:
 *
 *   cd apps/api && npx ts-node prisma/assistant-smoke.ts
 */
import { PrismaClient } from '@prisma/client';
import { DailyMonitoringService } from '../src/modules/assistant/services/daily-monitoring.service';
import { LifeInsightService } from '../src/modules/assistant/services/life-insight.service';
import { RecommendationService } from '../src/modules/assistant/services/recommendation.service';

const prisma = new PrismaClient();
const today = new Date().toISOString().slice(0, 10);

async function main() {
  const demo = await prisma.user.findUnique({ where: { email: 'demo@planner.local' } });
  if (!demo) throw new Error('demo user missing — run db:seed');

  const monitor = new DailyMonitoringService(prisma as never);
  const insight = new LifeInsightService(prisma as never);
  const rec = new RecommendationService(prisma as never);

  const signals = await monitor.collect(demo.id, today);
  const scores = await insight.score(demo.id, today);

  console.log(`---- SIGNALS (${signals.length}) ----`);
  for (const s of signals) {
    console.log(`  [${s.severity.padEnd(6)}] ${s.code}`, JSON.stringify(s.payload).slice(0, 120));
  }

  console.log('\n---- SCORES ----');
  console.log(JSON.stringify(scores, null, 2));

  console.log('\n---- CREATING SAMPLE RECOMMENDATIONS (vi) ----');
  for (const s of signals.slice(0, 4)) {
    const r = await rec.createFromSignal(demo.id, s, 'vi');
    console.log(`  ${r.created ? '+' : '='} ${r.type.padEnd(8)} ${r.priority.padEnd(6)} ${r.title}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
