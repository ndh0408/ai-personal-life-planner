import { Injectable, Logger } from '@nestjs/common';
import type { Prisma, UserPattern } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrivacyService, type PrivacyGates } from '../privacy/privacy.service';

/**
 * Compact in-memory signal struct fed to the rule engine. Stays out of DB
 * for hot-path runs (every minute would balloon `context_signals`); the
 * service writes a `ContextSignal` row only for signals that actually
 * fired AND a notable inference was emitted, so the table tracks "what
 * triggered this nudge" not "every metric we polled".
 */
export interface CollectedSignals {
  now: Date;
  hourLocal: number;
  /** Per-domain gates, copied from PrivacyService for downstream use. */
  gates: PrivacyGates;
  /** All UserPattern rows keyed by patternType for fast lookup. */
  patterns: Record<string, UserPattern>;

  // Sleep / mood / health — only populated when health gate is on
  lastSleepDurationMin: number | null;
  lastSleepEndedAt: Date | null;
  latestMood: { energy: 'LOW' | 'MEDIUM' | 'HIGH' | null; stress: 'LOW' | 'MEDIUM' | 'HIGH' | null } | null;

  // Schedule / tasks / habits — only when schedule/tasks/habits gate is on
  pendingTasksCount: number;
  pendingTasksAfter21Count: number;
  overdueTasksCount: number;
  habitsMissedToday: number;
  hasReviewToday: boolean;

  // Meals
  mealLogsToday: { breakfast: boolean; lunch: boolean; dinner: boolean };

  // Finance — only when finance gate is on
  budgetUsages: Array<{ category: string; usagePercent: number; threshold: number }>;
  daysLeftInMonth: number;
}

/**
 * Pure-data collector. Issues at most ~12 lightweight Prisma reads scoped
 * to the user. Privacy gates short-circuit each domain.
 */
@Injectable()
export class ContextSignalService {
  private readonly logger = new Logger(ContextSignalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly privacy: PrivacyService,
  ) {}

  async collect(userId: string, patterns: UserPattern[], now = new Date()): Promise<CollectedSignals> {
    const gates = await this.privacy.aiGates(userId);
    const patternsMap = Object.fromEntries(patterns.map((p) => [p.patternType, p])) as Record<
      string,
      UserPattern
    >;

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday.getTime() + 86_400_000);
    const startOfYesterday = new Date(startOfToday.getTime() - 86_400_000);

    // ---- Health (sleep/mood) — gated by health domain --------------------
    let lastSleepDurationMin: number | null = null;
    let lastSleepEndedAt: Date | null = null;
    let latestMood: CollectedSignals['latestMood'] = null;
    if (gates.health) {
      const [sleep, mood] = await Promise.all([
        this.prisma.sleepLog.findFirst({
          where: { userId, date: { gte: startOfYesterday, lt: endOfToday } },
          orderBy: { date: 'desc' },
          select: { durationMinutes: true, wakeTime: true },
        }),
        this.prisma.moodLog.findFirst({
          where: { userId, date: { gte: startOfToday, lt: endOfToday } },
          orderBy: { date: 'desc' },
          select: { energyLevel: true, stressLevel: true },
        }),
      ]);
      lastSleepDurationMin = sleep?.durationMinutes ?? null;
      lastSleepEndedAt = sleep?.wakeTime ?? null;
      latestMood = mood
        ? { energy: mood.energyLevel ?? null, stress: mood.stressLevel ?? null }
        : null;
    }

    // ---- Tasks ------------------------------------------------------------
    let pendingTasksCount = 0;
    let pendingTasksAfter21Count = 0;
    let overdueTasksCount = 0;
    if (gates.tasks) {
      const [pending, overdue, lateOnes] = await Promise.all([
        this.prisma.task.count({ where: { userId, status: { in: ['TODO', 'IN_PROGRESS'] } } }),
        this.prisma.task.count({
          where: { userId, status: { in: ['TODO', 'IN_PROGRESS'] }, dueDate: { lt: now } },
        }),
        // After-21:00 anchor only matters when current local hour ≥ 21.
        now.getHours() >= 21
          ? this.prisma.task.count({
              where: {
                userId,
                status: { in: ['TODO', 'IN_PROGRESS'] },
                dueDate: { gte: startOfToday, lt: endOfToday },
              },
            })
          : Promise.resolve(0),
      ]);
      pendingTasksCount = pending;
      overdueTasksCount = overdue;
      pendingTasksAfter21Count = lateOnes;
    }

    // ---- Habits -----------------------------------------------------------
    let habitsMissedToday = 0;
    if (gates.habits) {
      const habits = await this.prisma.habit.findMany({
        where: { userId, isActive: true, frequency: 'DAILY' },
        select: {
          id: true,
          logs: { where: { date: { gte: startOfToday, lt: endOfToday }, completed: true }, take: 1 },
        },
      });
      habitsMissedToday = habits.filter((h) => h.logs.length === 0).length;
    }

    // ---- Meals ------------------------------------------------------------
    const mealLogsToday = { breakfast: false, lunch: false, dinner: false };
    if (gates.meals) {
      const meals = await this.prisma.mealLog.findMany({
        where: { userId, date: { gte: startOfToday, lt: endOfToday } },
        select: { mealType: true },
      });
      for (const m of meals) {
        if (m.mealType === 'BREAKFAST') mealLogsToday.breakfast = true;
        if (m.mealType === 'LUNCH') mealLogsToday.lunch = true;
        if (m.mealType === 'DINNER') mealLogsToday.dinner = true;
      }
    }

    // ---- Finance ----------------------------------------------------------
    let budgetUsages: CollectedSignals['budgetUsages'] = [];
    if (gates.finance) {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const [budgets, monthExpenses] = await Promise.all([
        this.prisma.budget.findMany({
          where: { userId },
          select: { category: true, amount: true, alertThresholdPercent: true },
        }),
        this.prisma.expense.findMany({
          where: { userId, expenseDate: { gte: monthStart, lt: monthEnd } },
          select: { category: true, amount: true },
        }),
      ]);
      const sumByCategory = new Map<string, number>();
      for (const e of monthExpenses) {
        sumByCategory.set(e.category, (sumByCategory.get(e.category) ?? 0) + Number(e.amount));
      }
      budgetUsages = budgets.map((b) => {
        const spent = sumByCategory.get(b.category) ?? 0;
        const usagePercent = Number(b.amount) > 0 ? (spent / Number(b.amount)) * 100 : 0;
        return { category: b.category, usagePercent, threshold: b.alertThresholdPercent ?? 80 };
      });
    }

    // ---- Review presence --------------------------------------------------
    let hasReviewToday = false;
    if (gates.schedule) {
      hasReviewToday = (await this.prisma.dailyReview.count({
        where: { userId, date: { gte: startOfToday, lt: endOfToday } },
      })) > 0;
    }

    const monthEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const daysLeftInMonth = Math.max(1, monthEndDate.getDate() - now.getDate());

    return {
      now,
      hourLocal: now.getHours(),
      gates,
      patterns: patternsMap,
      lastSleepDurationMin,
      lastSleepEndedAt,
      latestMood,
      pendingTasksCount,
      pendingTasksAfter21Count,
      overdueTasksCount,
      habitsMissedToday,
      hasReviewToday,
      mealLogsToday,
      budgetUsages,
      daysLeftInMonth,
    };
  }

  /** Persist a metadata-only signal row (used when an inference fired). */
  async pin(
    userId: string,
    type: Prisma.ContextSignalCreateInput['type'],
    value: Prisma.InputJsonValue,
    source: string,
    occurredAt = new Date(),
    confidence?: number,
  ): Promise<void> {
    try {
      await this.prisma.contextSignal.create({
        data: { userId, type, value, source, occurredAt, confidence: confidence ?? null },
      });
    } catch (e) {
      this.logger.warn(`pin failed: ${(e as Error).message.slice(0, 200)}`);
    }
  }
}
