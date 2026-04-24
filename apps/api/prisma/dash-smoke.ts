import { PrismaClient } from '@prisma/client';
import { LocaleService } from '../src/common/i18n/locale.service';
import { DailyMonitoringService } from '../src/modules/assistant/services/daily-monitoring.service';
import { LifeInsightService } from '../src/modules/assistant/services/life-insight.service';
import { RecommendationService } from '../src/modules/assistant/services/recommendation.service';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';

async function main() {
  const prisma = new PrismaClient();
  const locale = new LocaleService(prisma as never);
  const mon = new DailyMonitoringService(prisma as never);
  const life = new LifeInsightService(prisma as never);
  const rec = new RecommendationService(prisma as never);
  const svc = new DashboardService(prisma as never, locale, mon, life, rec);
  const user = await prisma.user.findUnique({ where: { email: 'demo@planner.local' } });
  if (!user) throw new Error('demo user missing');
  const out = await svc.summary(user.id, new Date().toISOString().slice(0, 10), {});
  console.log(JSON.stringify({
    date: out.date, locale: out.locale, greeting: out.greeting,
    topRec: out.assistantHighlight?.title,
    finance: out.finance, tasks: out.tasks,
    goals: { activeTotal: out.goals.activeTotal, behind: out.goals.behind, topSaving: out.goals.topSaving?.title },
    health: out.health, todayPlan: out.todayPlan, scores: out.scores,
  }, null, 2));
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
