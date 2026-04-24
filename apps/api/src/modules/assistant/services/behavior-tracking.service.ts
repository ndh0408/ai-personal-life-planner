import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Behavior pattern detection.
 *
 * This service answers questions like "which habit drops most often?",
 * "which hour of day do tasks get postponed?", "is spending skewed toward
 * weekends?" — informational only. The copy is produced elsewhere; this
 * service just returns the numbers.
 */

export type BehaviorPatterns = {
  tasks: {
    /** Distribution of overdue / postponed tasks by hour-of-day window. */
    postponementHours: Array<{ hourBucket: string; count: number }>;
    /** Task category with the highest postponement ratio. */
    worstCategory: { category: string; postponed: number; total: number } | null;
  };
  habits: {
    /** Habits in active set ranked by completion% in trailing 14d. */
    ranked: Array<{ habitId: string; name: string; completionPercent: number; days: number }>;
    bestHabit: string | null;
    worstHabit: string | null;
  };
  sleep: {
    /** Weekday (0=Sun) with most late-night (>=00:00) sleepTime entries. */
    lateNightWeekday: number | null;
    averageDurationMinutes: number | null;
  };
  productivity: {
    /** Hour block where most scheduled items get marked COMPLETED. */
    bestHourBucket: string | null;
  };
  spending: {
    /** Expense category with largest deviation vs 30-day baseline (trailing 7d). */
    risingCategory: { category: string; recent: number; baseline: number } | null;
    /** Day-of-week (0=Sun) with largest avg spend over trailing 4 weeks. */
    heaviestWeekday: number | null;
  };
  goals: {
    /** Personal goals below 40% progress with deadline <60d. */
    stalledGoalIds: string[];
  };
  overload: {
    /** Count of days in trailing 14d with >= 10 schedule items. */
    overloadedDays: number;
  };
};

function daysAgo(n: number, from: Date = new Date()): Date {
  const d = new Date(from);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function hourBucket(d: Date): string {
  const h = d.getUTCHours();
  if (h < 6) return '00-06';
  if (h < 12) return '06-12';
  if (h < 18) return '12-18';
  return '18-24';
}

@Injectable()
export class BehaviorTrackingService {
  constructor(private readonly prisma: PrismaService) {}

  async analyze(userId: string): Promise<BehaviorPatterns> {
    const now = new Date();
    const d7 = daysAgo(7, now);
    const d14 = daysAgo(14, now);
    const d30 = daysAgo(30, now);

    const [tasks, habits, habitLogs, sleepLogs, expenses30, scheduleItems, schedules, goals] =
      await Promise.all([
        this.prisma.task.findMany({
          where: { userId, createdAt: { gte: d30 } },
          select: { id: true, status: true, category: true, dueDate: true, updatedAt: true },
        }),
        this.prisma.habit.findMany({ where: { userId, isActive: true } }),
        this.prisma.habitLog.findMany({
          where: { userId, date: { gte: d14 } },
          select: { habitId: true, date: true, completed: true },
        }),
        this.prisma.sleepLog.findMany({
          where: { userId, date: { gte: d30 } },
          select: { date: true, sleepTime: true, durationMinutes: true },
        }),
        this.prisma.expense.findMany({
          where: { userId, expenseDate: { gte: d30 } },
          select: { amount: true, category: true, expenseDate: true },
        }),
        this.prisma.scheduleItem.findMany({
          where: { userId, startTime: { gte: d14 } },
          select: { startTime: true, status: true },
        }),
        this.prisma.dailySchedule.findMany({
          where: { userId, date: { gte: d14 } },
          include: { items: { select: { id: true } } },
        }),
        this.prisma.personalGoal.findMany({
          where: { userId, status: 'ACTIVE' },
          select: { id: true, targetValue: true, currentValue: true, deadline: true },
        }),
      ]);

    // ---- Tasks ---------------------------------------------------------------
    const postponedTasks = tasks.filter(
      (t) => t.status !== 'COMPLETED' && t.dueDate && t.dueDate < now,
    );
    const postponementHoursMap = new Map<string, number>();
    for (const t of postponedTasks) {
      if (!t.dueDate) continue;
      const b = hourBucket(t.dueDate);
      postponementHoursMap.set(b, (postponementHoursMap.get(b) ?? 0) + 1);
    }
    const byCategory = new Map<string, { postponed: number; total: number }>();
    for (const t of tasks) {
      const cat = t.category ?? '(uncategorized)';
      const prev = byCategory.get(cat) ?? { postponed: 0, total: 0 };
      prev.total += 1;
      if (t.status !== 'COMPLETED' && t.dueDate && t.dueDate < now) prev.postponed += 1;
      byCategory.set(cat, prev);
    }
    let worstCategory: BehaviorPatterns['tasks']['worstCategory'] = null;
    for (const [category, v] of byCategory.entries()) {
      if (v.total < 2) continue;
      if (!worstCategory || v.postponed / v.total > worstCategory.postponed / worstCategory.total) {
        worstCategory = { category, ...v };
      }
    }

    // ---- Habits --------------------------------------------------------------
    const rankedHabits = habits.map((h) => {
      const logs = habitLogs.filter((l) => l.habitId === h.id);
      const days = new Set(logs.map((l) => l.date.toISOString().slice(0, 10))).size;
      const completed = logs.filter((l) => l.completed).length;
      const pct = logs.length > 0 ? Math.round((completed / logs.length) * 100) : 0;
      return { habitId: h.id, name: h.name, completionPercent: pct, days };
    });
    rankedHabits.sort((a, b) => b.completionPercent - a.completionPercent);
    const bestHabit = rankedHabits[0]?.name ?? null;
    const worstHabit = rankedHabits.length > 1 ? rankedHabits[rankedHabits.length - 1].name : null;

    // ---- Sleep ---------------------------------------------------------------
    const lateNightByDow = new Map<number, number>();
    let totalDuration = 0;
    for (const s of sleepLogs) {
      totalDuration += s.durationMinutes;
      const h = s.sleepTime.getUTCHours();
      if (h === 0 || h === 1 || h === 23) {
        const dow = s.date.getUTCDay();
        lateNightByDow.set(dow, (lateNightByDow.get(dow) ?? 0) + 1);
      }
    }
    let lateNightWeekday: number | null = null;
    let maxLate = 0;
    for (const [dow, n] of lateNightByDow.entries()) {
      if (n > maxLate) {
        maxLate = n;
        lateNightWeekday = dow;
      }
    }
    const averageDurationMinutes =
      sleepLogs.length > 0 ? Math.round(totalDuration / sleepLogs.length) : null;

    // ---- Productivity --------------------------------------------------------
    const completedByBucket = new Map<string, number>();
    for (const item of scheduleItems) {
      if (item.status !== 'COMPLETED') continue;
      const b = hourBucket(item.startTime);
      completedByBucket.set(b, (completedByBucket.get(b) ?? 0) + 1);
    }
    let bestHourBucket: string | null = null;
    let bestCount = 0;
    for (const [b, n] of completedByBucket.entries()) {
      if (n > bestCount) {
        bestCount = n;
        bestHourBucket = b;
      }
    }

    // ---- Spending ------------------------------------------------------------
    const byCat7 = new Map<string, number>();
    const byCatBaseline = new Map<string, number>();
    const byDow = new Map<number, { total: number; days: Set<string> }>();
    for (const e of expenses30) {
      const amt = Number(e.amount);
      const d = e.expenseDate;
      const dow = d.getUTCDay();
      const dowKey = d.toISOString().slice(0, 10);
      const prev = byDow.get(dow) ?? { total: 0, days: new Set() };
      prev.total += amt;
      prev.days.add(dowKey);
      byDow.set(dow, prev);
      if (d >= d7) {
        byCat7.set(e.category, (byCat7.get(e.category) ?? 0) + amt);
      } else {
        byCatBaseline.set(e.category, (byCatBaseline.get(e.category) ?? 0) + amt);
      }
    }
    let risingCategory: BehaviorPatterns['spending']['risingCategory'] = null;
    for (const [cat, recent] of byCat7.entries()) {
      const baseline = (byCatBaseline.get(cat) ?? 0) / 23; // prior 23 days
      const recentDaily = recent / 7;
      if (baseline > 0 && recentDaily > baseline * 1.5) {
        if (!risingCategory || recentDaily - baseline > risingCategory.recent - risingCategory.baseline) {
          risingCategory = { category: cat, recent: Math.round(recentDaily), baseline: Math.round(baseline) };
        }
      }
    }
    let heaviestWeekday: number | null = null;
    let heaviestAvg = 0;
    for (const [dow, v] of byDow.entries()) {
      const avg = v.total / Math.max(1, v.days.size);
      if (avg > heaviestAvg) {
        heaviestAvg = avg;
        heaviestWeekday = dow;
      }
    }

    // ---- Goals ---------------------------------------------------------------
    const stalled = goals
      .filter(
        (g) =>
          g.targetValue !== null &&
          g.currentValue !== null &&
          g.targetValue > 0 &&
          g.deadline &&
          g.currentValue / g.targetValue < 0.4 &&
          g.deadline.getTime() - now.getTime() < 60 * 86_400_000,
      )
      .map((g) => g.id);

    // ---- Overload -----------------------------------------------------------
    const overloadedDays = schedules.filter((s) => s.items.length >= 10).length;

    return {
      tasks: {
        postponementHours: [...postponementHoursMap.entries()].map(([hourBucket, count]) => ({
          hourBucket,
          count,
        })),
        worstCategory,
      },
      habits: { ranked: rankedHabits, bestHabit, worstHabit },
      sleep: { lateNightWeekday, averageDurationMinutes },
      productivity: { bestHourBucket },
      spending: { risingCategory, heaviestWeekday },
      goals: { stalledGoalIds: stalled },
      overload: { overloadedDays },
    };
  }
}
