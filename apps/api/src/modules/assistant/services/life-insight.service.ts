import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { PersonalScore, Trend } from './types';

function daysAgo(n: number, from: Date = new Date()): Date {
  const d = new Date(from);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function dayStart(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

const TARGET_SLEEP_MIN = 7 * 60;

/**
 * Personal Score engine.
 *
 * Every metric is 0..100 and framed non-judgmentally: 100 doesn't mean
 * "perfect", it means "no signal that anything is off". The app shouldn't
 * surface these as grades — use them to pick which recommendations to raise
 * and which insights to narrate.
 *
 * Null is a legitimate output: when there isn't enough data to compute a
 * dimension (e.g. no schedule), the UI should say "not enough data" rather
 * than imply a zero.
 */
@Injectable()
export class LifeInsightService {
  constructor(private readonly prisma: PrismaService) {}

  async score(userId: string, today: string): Promise<PersonalScore> {
    const todayStart = dayStart(today);
    const d7 = daysAgo(7, todayStart);
    const d14 = daysAgo(14, todayStart);

    const [
      schedule,
      tasks7,
      habits,
      habitLogs7,
      sleepLogs14,
      moodLogs14,
      mealPlans7,
      mealLogs7,
      budgets,
      expenses,
      savingGoals,
      personalGoals,
    ] = await Promise.all([
      this.prisma.dailySchedule.findFirst({
        where: { userId, date: todayStart },
        include: { items: { select: { status: true } } },
      }),
      this.prisma.task.findMany({
        where: { userId, dueDate: { gte: d7, lt: new Date(todayStart.getTime() + 86_400_000) } },
        select: { status: true },
      }),
      this.prisma.habit.findMany({ where: { userId, isActive: true }, select: { id: true, frequency: true, targetCount: true } }),
      this.prisma.habitLog.findMany({
        where: { userId, date: { gte: d7, lt: new Date(todayStart.getTime() + 86_400_000) } },
        select: { habitId: true, completed: true },
      }),
      this.prisma.sleepLog.findMany({
        where: { userId, date: { gte: d14, lt: new Date(todayStart.getTime() + 86_400_000) } },
        select: { durationMinutes: true, date: true },
        orderBy: { date: 'asc' },
      }),
      this.prisma.moodLog.findMany({
        where: { userId, date: { gte: d14, lt: new Date(todayStart.getTime() + 86_400_000) } },
        select: { energyLevel: true, stressLevel: true, date: true },
        orderBy: { date: 'asc' },
      }),
      this.prisma.mealPlan.count({
        where: { userId, date: { gte: d7, lt: new Date(todayStart.getTime() + 86_400_000) } },
      }),
      this.prisma.mealLog.count({
        where: { userId, date: { gte: d7, lt: new Date(todayStart.getTime() + 86_400_000) } },
      }),
      this.prisma.budget.findMany({ where: { userId } }),
      this.prisma.expense.findMany({
        where: { userId, expenseDate: { gte: d7, lt: new Date(todayStart.getTime() + 86_400_000) } },
      }),
      this.prisma.savingGoal.findMany({ where: { userId, status: 'ACTIVE' } }),
      this.prisma.personalGoal.findMany({ where: { userId, status: 'ACTIVE' } }),
    ]);

    // ---- schedule ----
    let scheduleCompletionRate: number | null = null;
    if (schedule && schedule.items.length > 0) {
      const completed = schedule.items.filter((i) => i.status === 'COMPLETED').length;
      scheduleCompletionRate = Math.round((completed / schedule.items.length) * 100);
    }

    // ---- tasks ----
    let taskCompletionRate: number | null = null;
    if (tasks7.length > 0) {
      const completed = tasks7.filter((t) => t.status === 'COMPLETED').length;
      taskCompletionRate = Math.round((completed / tasks7.length) * 100);
    }

    // ---- habits ----
    let habitConsistencyRate: number | null = null;
    if (habits.length > 0 && habitLogs7.length > 0) {
      const completed = habitLogs7.filter((l) => l.completed).length;
      const expected = habits.length * 7; // daily habits; weekly slightly over-counts (fine — generous)
      habitConsistencyRate = Math.min(100, Math.round((completed / expected) * 100));
    }

    // ---- sleep consistency ----
    let sleepConsistencyScore: number | null = null;
    if (sleepLogs14.length >= 3) {
      const durations = sleepLogs14.map((l) => l.durationMinutes);
      const avg = durations.reduce((s, v) => s + v, 0) / durations.length;
      const variance =
        durations.reduce((s, v) => s + (v - avg) ** 2, 0) / durations.length;
      const stddev = Math.sqrt(variance);
      // lower stddev + avg within ~30min of target = higher score
      const distance = Math.abs(avg - TARGET_SLEEP_MIN);
      const distancePenalty = Math.min(50, Math.round(distance / 6)); // 30min = 5pts, 3h = 30pts
      const variancePenalty = Math.min(50, Math.round(stddev / 6));
      sleepConsistencyScore = Math.max(0, 100 - distancePenalty - variancePenalty);
    }

    // ---- workload ----
    // Counts items/day; penalize days with > 8 items.
    let workloadBalanceScore: number | null = null;
    if (schedule) {
      const daysSchedules = await this.prisma.dailySchedule.findMany({
        where: { userId, date: { gte: d7 } },
        include: { items: { select: { id: true } } },
      });
      if (daysSchedules.length > 0) {
        const overloadedDays = daysSchedules.filter((s) => s.items.length >= 10).length;
        const penaltyPerDay = 12;
        workloadBalanceScore = Math.max(
          0,
          100 - overloadedDays * penaltyPerDay,
        );
      }
    }

    // ---- meal consistency ----
    let mealConsistencyScore: number | null = null;
    if (mealPlans7 > 0) {
      // Each plan ~3 suggestions. We count log ratio vs 3*plans.
      const expected = mealPlans7 * 3;
      mealConsistencyScore = Math.min(100, Math.round((mealLogs7 / expected) * 100));
    }

    // ---- budget health ----
    let budgetHealthScore: number | null = null;
    if (budgets.length > 0) {
      let overThreshold = 0;
      for (const b of budgets) {
        const spent = expenses
          .filter((e) => e.category === b.category)
          .reduce((s, e) => s + Number(e.amount), 0);
        const pct = Number(b.amount) === 0 ? 0 : (spent / Number(b.amount)) * 100;
        if (pct >= b.alertThresholdPercent) overThreshold += 1;
      }
      budgetHealthScore = Math.max(
        0,
        100 - Math.round((overThreshold / budgets.length) * 100),
      );
    }

    // ---- saving progress ----
    let savingProgressScore: number | null = null;
    if (savingGoals.length > 0) {
      const pctSum = savingGoals.reduce((s, g) => {
        const t = Number(g.targetAmount);
        const c = Number(g.currentAmount);
        return s + (t > 0 ? (c / t) * 100 : 0);
      }, 0);
      savingProgressScore = Math.min(100, Math.round(pctSum / savingGoals.length));
    }

    // ---- goal progress ----
    let goalProgressScore: number | null = null;
    const goalsWithNumeric = personalGoals.filter(
      (g) => g.targetValue !== null && g.currentValue !== null && g.targetValue > 0,
    );
    if (goalsWithNumeric.length > 0) {
      const pctSum = goalsWithNumeric.reduce(
        (s, g) => s + ((g.currentValue as number) / (g.targetValue as number)) * 100,
        0,
      );
      goalProgressScore = Math.min(100, Math.round(pctSum / goalsWithNumeric.length));
    }

    // ---- trends ----
    const energyTrend = trendOver(moodLogs14.map((m) => energyToNumber(m.energyLevel)));
    const stressTrend = trendOver(moodLogs14.map((m) => stressToNumber(m.stressLevel)));

    return {
      scheduleCompletionRate,
      taskCompletionRate,
      habitConsistencyRate,
      sleepConsistencyScore,
      workloadBalanceScore,
      mealConsistencyScore,
      budgetHealthScore,
      savingProgressScore,
      goalProgressScore,
      energyTrend,
      stressTrend,
    };
  }
}

function energyToNumber(level: string): number {
  if (level === 'HIGH') return 3;
  if (level === 'MEDIUM') return 2;
  return 1;
}

function stressToNumber(level: string): number {
  if (level === 'HIGH') return 3;
  if (level === 'MEDIUM') return 2;
  return 1;
}

/**
 * Simple trend detector: split the series in half, compare means.
 * Returns UNKNOWN when the series is too short or flat by a wide margin.
 */
function trendOver(series: number[]): Trend {
  if (series.length < 4) return 'UNKNOWN';
  const half = Math.floor(series.length / 2);
  const first = series.slice(0, half);
  const second = series.slice(half);
  const firstAvg = first.reduce((s, v) => s + v, 0) / first.length;
  const secondAvg = second.reduce((s, v) => s + v, 0) / second.length;
  const diff = secondAvg - firstAvg;
  if (Math.abs(diff) < 0.25) return 'FLAT';
  return diff > 0 ? 'UP' : 'DOWN';
}
