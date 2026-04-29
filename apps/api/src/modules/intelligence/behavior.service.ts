/**
 * Computes UserBehaviorSummary — the "what does this user actually do?"
 * snapshot. AI consumers read this instead of re-aggregating 90 days of
 * history every time they run.
 *
 * Stored in the `UserBehaviorSummary` table; recomputed lazily when older
 * than 1h (cheap recompute on next AI call). Pushed events update the
 * eventsAtCompute counter so we know if the snapshot is stale.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface BehaviorSummary {
  wakeHistogram: number[]; // 24-bucket
  sleepHistogram: number[];
  avgSleepByWeekday: number[]; // 7 entries (Sun..Sat), minutes
  peakFocus: { start: number; end: number } | null;
  topExpenseCategories: Array<{ category: string; weeklyAmount: number; share: number }>;
  recentMealTitles: string[];
  moodSleepCorrelation: number | null;
  taskCompletionByPrio: Record<'LOW' | 'MEDIUM' | 'HIGH', number>;
}

const STALE_AFTER_MS = 60 * 60_000; // 1h

@Injectable()
export class BehaviorService {
  private readonly logger = new Logger(BehaviorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the cached summary if fresh enough; otherwise recomputes from
   * recent history. Always returns something — empty arrays / null fields
   * when the user has no data yet.
   */
  async get(userId: string): Promise<BehaviorSummary> {
    const existing = await this.prisma.userBehaviorSummary.findUnique({
      where: { userId },
    });
    const fresh =
      existing && Date.now() - existing.computedAt.getTime() < STALE_AFTER_MS;
    if (fresh && existing) return rowToSummary(existing);

    return this.recompute(userId);
  }

  /** Force recompute — call after big writes (capture confirm, plan toggle). */
  async recompute(userId: string): Promise<BehaviorSummary> {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60_000);

    const [sleeps, moods, expenses, meals, tasks] = await Promise.all([
      this.prisma.sleepLog.findMany({
        where: { userId, sleepAt: { gte: since } },
        orderBy: { sleepAt: 'desc' },
      }),
      this.prisma.moodLog.findMany({
        where: { userId, loggedAt: { gte: since } },
        orderBy: { loggedAt: 'desc' },
      }),
      this.prisma.expense.findMany({
        where: { userId, deletedAt: null, expenseDate: { gte: since } },
        select: { amount: true, category: true, expenseDate: true },
      }),
      this.prisma.mealLog.findMany({
        where: { userId, loggedAt: { gte: since } },
        orderBy: { loggedAt: 'desc' },
        take: 25,
        select: { title: true },
      }),
      this.prisma.task.findMany({
        where: { userId, deletedAt: null, createdAt: { gte: since } },
        select: { priority: true, status: true },
      }),
    ]);

    const wakeHistogram = histogramOfHours(sleeps.map((s) => s.wakeAt));
    const sleepHistogram = histogramOfHours(sleeps.map((s) => s.sleepAt));
    const avgSleepByWeekday = avgSleepPerWeekday(sleeps);
    const peakFocus = peakFocusWindow(sleeps);
    const topExpenseCategories = topCategories(expenses);
    const recentMealTitles = unique(meals.map((m) => m.title)).slice(0, 10);
    const moodSleepCorrelation = correlateMoodSleep(sleeps, moods);
    const taskCompletionByPrio = completionByPriority(tasks);

    const summary: BehaviorSummary = {
      wakeHistogram,
      sleepHistogram,
      avgSleepByWeekday,
      peakFocus,
      topExpenseCategories,
      recentMealTitles,
      moodSleepCorrelation,
      taskCompletionByPrio,
    };

    try {
      await this.prisma.userBehaviorSummary.upsert({
        where: { userId },
        update: {
          wakeHistogram: wakeHistogram as Prisma.InputJsonValue,
          sleepHistogram: sleepHistogram as Prisma.InputJsonValue,
          avgSleepByWeekday: avgSleepByWeekday as Prisma.InputJsonValue,
          peakFocus: (peakFocus ?? null) as Prisma.InputJsonValue,
          topExpenseCategories: topExpenseCategories as unknown as Prisma.InputJsonValue,
          recentMealTitles: recentMealTitles as Prisma.InputJsonValue,
          moodSleepCorrelation,
          taskCompletionByPrio: taskCompletionByPrio as unknown as Prisma.InputJsonValue,
          computedAt: new Date(),
        },
        create: {
          userId,
          wakeHistogram: wakeHistogram as Prisma.InputJsonValue,
          sleepHistogram: sleepHistogram as Prisma.InputJsonValue,
          avgSleepByWeekday: avgSleepByWeekday as Prisma.InputJsonValue,
          peakFocus: (peakFocus ?? null) as Prisma.InputJsonValue,
          topExpenseCategories: topExpenseCategories as unknown as Prisma.InputJsonValue,
          recentMealTitles: recentMealTitles as Prisma.InputJsonValue,
          moodSleepCorrelation,
          taskCompletionByPrio: taskCompletionByPrio as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (e) {
      this.logger.warn(`Behavior cache write failed for ${userId}: ${(e as Error).message}`);
    }

    return summary;
  }
}

// ── helpers ────────────────────────────────────────────────────────────────

function histogramOfHours(dates: Date[]): number[] {
  const buckets = new Array(24).fill(0);
  for (const d of dates) {
    // Treat hour-of-day as ICT — most users are VN. Good enough for a
    // behaviour signal; we don't need timezone-perfect bucketing.
    const local = new Date(d.getTime() + 7 * 60 * 60_000);
    buckets[local.getUTCHours()]++;
  }
  return buckets;
}

function avgSleepPerWeekday(sleeps: { sleepAt: Date; durationMinutes: number }[]): number[] {
  const sums = new Array(7).fill(0);
  const counts = new Array(7).fill(0);
  for (const s of sleeps) {
    const local = new Date(s.sleepAt.getTime() + 7 * 60 * 60_000);
    const wd = local.getUTCDay();
    sums[wd] += s.durationMinutes;
    counts[wd]++;
  }
  return sums.map((s, i) => (counts[i] > 0 ? Math.round(s / counts[i]) : 0));
}

function peakFocusWindow(
  sleeps: { wakeAt: Date }[],
): { start: number; end: number } | null {
  if (sleeps.length < 5) return null;
  // Heuristic: peak focus = wake_hour + 2h to wake_hour + 5h (typical
  // morning deep-work window). Take the median wake hour.
  const hours = sleeps
    .map((s) => new Date(s.wakeAt.getTime() + 7 * 60 * 60_000).getUTCHours())
    .sort((a, b) => a - b);
  const median = hours[Math.floor(hours.length / 2)];
  return { start: (median + 2) % 24, end: (median + 5) % 24 };
}

function topCategories(
  expenses: { amount: Prisma.Decimal; category: string }[],
): Array<{ category: string; weeklyAmount: number; share: number }> {
  if (expenses.length === 0) return [];
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const byCat = new Map<string, number>();
  for (const e of expenses) {
    byCat.set(e.category, (byCat.get(e.category) ?? 0) + Number(e.amount));
  }
  return Array.from(byCat.entries())
    .map(([category, sum]) => ({
      category,
      // Last 90 days → divide by ~13 weeks for "weekly".
      weeklyAmount: Math.round(sum / 13),
      share: total > 0 ? +(sum / total).toFixed(3) : 0,
    }))
    .sort((a, b) => b.weeklyAmount - a.weeklyAmount)
    .slice(0, 5);
}

function unique<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

/**
 * Pearson correlation between sleep hours (per night) and the next-day
 * mood score. Returns null when n < 5 (not enough signal to be honest).
 *
 * Mood map: GREAT=2 GOOD=1 OK=0 TIRED=-1 STRESSED=-1 SAD=-2.
 */
function correlateMoodSleep(
  sleeps: { sleepAt: Date; durationMinutes: number }[],
  moods: { loggedAt: Date; mood: string }[],
): number | null {
  const moodScore: Record<string, number> = {
    GREAT: 2,
    GOOD: 1,
    OK: 0,
    TIRED: -1,
    STRESSED: -1,
    SAD: -2,
  };
  const pairs: Array<[number, number]> = [];
  for (const s of sleeps) {
    const sleepDate = new Date(s.sleepAt);
    sleepDate.setHours(0, 0, 0, 0);
    const nextMood = moods.find((m) => {
      const md = new Date(m.loggedAt);
      md.setHours(0, 0, 0, 0);
      return md.getTime() - sleepDate.getTime() < 36 * 60 * 60_000 &&
             md.getTime() - sleepDate.getTime() >= 0;
    });
    if (nextMood) {
      const score = moodScore[nextMood.mood];
      if (typeof score === 'number') {
        pairs.push([s.durationMinutes / 60, score]);
      }
    }
  }
  if (pairs.length < 5) return null;
  const n = pairs.length;
  const meanX = pairs.reduce((s, [x]) => s + x, 0) / n;
  const meanY = pairs.reduce((s, [, y]) => s + y, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (const [x, y] of pairs) {
    num += (x - meanX) * (y - meanY);
    dx += (x - meanX) ** 2;
    dy += (y - meanY) ** 2;
  }
  const denom = Math.sqrt(dx * dy);
  return denom > 0 ? +(num / denom).toFixed(2) : null;
}

function completionByPriority(
  tasks: { priority: string; status: string }[],
): Record<'LOW' | 'MEDIUM' | 'HIGH', number> {
  const byPrio: Record<string, { total: number; done: number }> = {
    LOW: { total: 0, done: 0 },
    MEDIUM: { total: 0, done: 0 },
    HIGH: { total: 0, done: 0 },
  };
  for (const t of tasks) {
    const b = byPrio[t.priority];
    if (!b) continue;
    b.total++;
    if (t.status === 'COMPLETED') b.done++;
  }
  const result: Record<'LOW' | 'MEDIUM' | 'HIGH', number> = { LOW: 0, MEDIUM: 0, HIGH: 0 };
  for (const k of ['LOW', 'MEDIUM', 'HIGH'] as const) {
    result[k] = byPrio[k].total > 0 ? +(byPrio[k].done / byPrio[k].total).toFixed(2) : 0;
  }
  return result;
}

function rowToSummary(r: {
  wakeHistogram: unknown;
  sleepHistogram: unknown;
  avgSleepByWeekday: unknown;
  peakFocus: unknown;
  topExpenseCategories: unknown;
  recentMealTitles: unknown;
  moodSleepCorrelation: number | null;
  taskCompletionByPrio: unknown;
}): BehaviorSummary {
  const arr = (x: unknown): number[] =>
    Array.isArray(x) ? (x as number[]) : [];
  return {
    wakeHistogram: arr(r.wakeHistogram),
    sleepHistogram: arr(r.sleepHistogram),
    avgSleepByWeekday: arr(r.avgSleepByWeekday),
    peakFocus:
      r.peakFocus && typeof r.peakFocus === 'object'
        ? (r.peakFocus as { start: number; end: number })
        : null,
    topExpenseCategories: Array.isArray(r.topExpenseCategories)
      ? (r.topExpenseCategories as Array<{
          category: string;
          weeklyAmount: number;
          share: number;
        }>)
      : [],
    recentMealTitles: Array.isArray(r.recentMealTitles)
      ? (r.recentMealTitles as string[])
      : [],
    moodSleepCorrelation: r.moodSleepCorrelation,
    taskCompletionByPrio:
      r.taskCompletionByPrio && typeof r.taskCompletionByPrio === 'object'
        ? (r.taskCompletionByPrio as Record<'LOW' | 'MEDIUM' | 'HIGH', number>)
        : { LOW: 0, MEDIUM: 0, HIGH: 0 },
  };
}
