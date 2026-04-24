import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayBounds(date: string): { from: Date; to: Date } {
  const from = startOfDay(new Date(`${date}T00:00:00.000Z`));
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return { from, to };
}

function weekBounds(weekStart: string): { from: Date; to: Date; to7dLabels: string[] } {
  const from = startOfDay(new Date(`${weekStart}T00:00:00.000Z`));
  const to = new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
  const labels: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(from.getTime() + i * 24 * 60 * 60 * 1000);
    labels.push(d.toISOString().slice(0, 10));
  }
  return { from, to, to7dLabels: labels };
}

function monthBounds(month: string): { from: Date; to: Date } {
  const [y, m] = month.split('-').map((x) => Number(x));
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 1));
  return { from, to };
}

function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Aggregates a single day:
   *   - tasks due on that day + status breakdown
   *   - habits logged / target breakdown
   *   - sleep + mood snapshots
   *   - meals logged
   *   - expenses total by category
   *   - schedule item completion
   *
   * AI-generated narrative belongs to AiModule — this endpoint only exposes
   * structured numbers. Mobile composes both.
   */
  async daily(userId: string, date: string) {
    const { from, to } = dayBounds(date);

    const [tasks, habitLogs, totalHabits, sleep, mood, schedule, meals, expenses] =
      await Promise.all([
        this.prisma.task.findMany({
          where: { userId, dueDate: { gte: from, lt: to } },
          select: { id: true, title: true, status: true, priority: true, estimatedMinutes: true },
        }),
        this.prisma.habitLog.findMany({
          where: { userId, date: from },
          select: { id: true, habitId: true, completed: true, count: true },
        }),
        this.prisma.habit.count({ where: { userId, isActive: true } }),
        this.prisma.sleepLog.findFirst({
          where: { userId, date: from },
          select: { durationMinutes: true, quality: true },
        }),
        this.prisma.moodLog.findFirst({
          where: { userId, date: from },
          select: { mood: true, energyLevel: true, stressLevel: true },
        }),
        this.prisma.dailySchedule.findFirst({
          where: { userId, date: from },
          select: { id: true, status: true, items: { select: { status: true } } },
        }),
        this.prisma.mealLog.findMany({
          where: { userId, date: from },
          select: { id: true, mealType: true, title: true, estimatedCalories: true, cost: true },
        }),
        this.prisma.expense.findMany({
          where: { userId, expenseDate: from },
          select: { amount: true, category: true, title: true },
        }),
      ]);

    const taskByStatus = tasks.reduce<Record<string, number>>((acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    }, {});

    const habitsCompleted = habitLogs.filter((l) => l.completed).length;
    const scheduleItemsTotal = schedule?.items.length ?? 0;
    const scheduleItemsDone =
      schedule?.items.filter((i) => i.status === 'COMPLETED').length ?? 0;

    const spendingByCategory = expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + toNumber(e.amount);
      return acc;
    }, {});
    const totalSpending = expenses.reduce((sum, e) => sum + toNumber(e.amount), 0);
    const totalCalories = meals.reduce((sum, m) => sum + (m.estimatedCalories ?? 0), 0);
    const totalMealCost = meals.reduce((sum, m) => sum + toNumber(m.cost), 0);

    return {
      date,
      tasks: {
        total: tasks.length,
        byStatus: taskByStatus,
        totalEstimatedMinutes: tasks.reduce(
          (sum, t) => sum + (t.estimatedMinutes ?? 0),
          0,
        ),
        overdue: tasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length,
      },
      habits: {
        active: totalHabits,
        logged: habitLogs.length,
        completed: habitsCompleted,
      },
      schedule: schedule
        ? {
            id: schedule.id,
            status: schedule.status,
            items: { total: scheduleItemsTotal, completed: scheduleItemsDone },
          }
        : null,
      sleep: sleep ?? null,
      mood: mood ?? null,
      meals: {
        count: meals.length,
        totalCalories,
        totalCost: totalMealCost,
        items: meals.map((m) => ({
          id: m.id,
          type: m.mealType,
          title: m.title,
          estimatedCalories: m.estimatedCalories ?? null,
          cost: m.cost !== null && m.cost !== undefined ? toNumber(m.cost) : null,
        })),
      },
      spending: {
        total: totalSpending,
        byCategory: spendingByCategory,
        topExpenses: expenses
          .slice()
          .sort((a, b) => toNumber(b.amount) - toNumber(a.amount))
          .slice(0, 3)
          .map((e) => ({
            title: e.title,
            amount: toNumber(e.amount),
            category: e.category,
          })),
      },
    };
  }

  /**
   * 7-day window starting at weekStart (YYYY-MM-DD). Returns schedule + task
   * + habit + sleep + mood + meal + spending + budget-warning + goal-progress
   * aggregates as one structured payload. AI narrative is a separate call.
   */
  async weekly(userId: string, weekStart: string) {
    const { from, to, to7dLabels } = weekBounds(weekStart);
    const weekEnd = new Date(to.getTime() - 1);
    const todayIso = new Date().toISOString().slice(0, 10);

    const [tasks, habitLogs, activeHabits, sleepLogs, moodLogs, meals, schedules, expenses, budgets, goals] =
      await Promise.all([
        this.prisma.task.groupBy({
          by: ['status'],
          where: { userId, dueDate: { gte: from, lte: weekEnd } },
          _count: { _all: true },
        }),
        this.prisma.habitLog.findMany({
          where: { userId, date: { gte: from, lte: weekEnd } },
          select: { date: true, completed: true },
        }),
        this.prisma.habit.count({ where: { userId, isActive: true } }),
        this.prisma.sleepLog.findMany({
          where: { userId, date: { gte: from, lte: weekEnd } },
          select: { durationMinutes: true, quality: true, date: true },
          orderBy: { date: 'asc' },
        }),
        this.prisma.moodLog.findMany({
          where: { userId, date: { gte: from, lte: weekEnd } },
          select: { mood: true, energyLevel: true, stressLevel: true, date: true },
          orderBy: { date: 'asc' },
        }),
        this.prisma.mealLog.findMany({
          where: { userId, date: { gte: from, lte: weekEnd } },
          select: { date: true, mealType: true },
        }),
        this.prisma.dailySchedule.findMany({
          where: { userId, date: { gte: from, lte: weekEnd } },
          select: { date: true, items: { select: { status: true } } },
        }),
        this.prisma.expense.findMany({
          where: { userId, expenseDate: { gte: from, lte: weekEnd } },
          select: { amount: true, category: true, expenseDate: true, needLevel: true },
        }),
        this.prisma.budget.findMany({
          where: {
            userId,
            AND: [{ startDate: { lte: weekEnd } }, { endDate: { gte: from } }],
          },
          select: { id: true, category: true, amount: true, period: true, startDate: true, endDate: true, alertThresholdPercent: true },
        }),
        this.prisma.personalGoal.findMany({
          where: { userId, status: 'ACTIVE' },
          select: {
            id: true,
            title: true,
            targetValue: true,
            currentValue: true,
            deadline: true,
            category: true,
            milestones: { select: { id: true, status: true } },
          },
        }),
      ]);

    const sleepAvg =
      sleepLogs.length > 0
        ? Math.round(
            sleepLogs.reduce((s, x) => s + (x.durationMinutes ?? 0), 0) / sleepLogs.length,
          )
        : null;

    // Per-day schedule completion — used for the simple bar chart on mobile.
    const completionByDay = to7dLabels.map((iso) => {
      const day = schedules.find((s) => s.date.toISOString().slice(0, 10) === iso);
      const total = day?.items.length ?? 0;
      const done = day?.items.filter((i) => i.status === 'COMPLETED').length ?? 0;
      return { date: iso, total, completed: done };
    });
    const totalScheduleItems = completionByDay.reduce((s, d) => s + d.total, 0);
    const totalScheduleDone = completionByDay.reduce((s, d) => s + d.completed, 0);

    const habitsCompleted = habitLogs.filter((l) => l.completed).length;
    const habitsTarget = activeHabits * 7;

    // Meals per day — simple "consistency" = days with ≥1 logged meal.
    const mealDays = new Set(meals.map((m) => m.date.toISOString().slice(0, 10))).size;

    // Spending totals + by-category for the week.
    const weekSpending = expenses.reduce((s, e) => s + toNumber(e.amount), 0);
    const spendingByCategory = expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + toNumber(e.amount);
      return acc;
    }, {});
    const spendByDay = to7dLabels.map((iso) => ({
      date: iso,
      amount: expenses
        .filter((e) => e.expenseDate.toISOString().slice(0, 10) === iso)
        .reduce((s, e) => s + toNumber(e.amount), 0),
    }));

    // Budget warnings — compute usage within each budget's period window.
    const budgetWarnings = await Promise.all(
      budgets.map(async (b) => {
        const spent = await this.prisma.expense.aggregate({
          where: {
            userId,
            category: b.category,
            expenseDate: { gte: b.startDate, lte: b.endDate },
          },
          _sum: { amount: true },
        });
        const usedAmount = toNumber(spent._sum.amount);
        const usedPercent = toNumber(b.amount) > 0
          ? Math.round((usedAmount / toNumber(b.amount)) * 100)
          : 0;
        return {
          id: b.id,
          category: b.category,
          amount: toNumber(b.amount),
          used: usedAmount,
          usedPercent,
          overThreshold: usedPercent >= b.alertThresholdPercent,
          period: b.period,
        };
      }),
    );

    // Goal progress: numeric % when target/current are set, else milestone %.
    const goalProgress = goals.map((g) => {
      let percent: number | null = null;
      if (g.targetValue !== null && g.currentValue !== null && g.targetValue > 0) {
        percent = Math.max(0, Math.min(100, Math.round((g.currentValue / g.targetValue) * 100)));
      } else if (g.milestones.length > 0) {
        const done = g.milestones.filter((m) => m.status === 'COMPLETED').length;
        percent = Math.round((done / g.milestones.length) * 100);
      }
      const behind =
        g.deadline !== null &&
        percent !== null &&
        new Date(g.deadline).toISOString().slice(0, 10) < todayIso &&
        percent < 100;
      return {
        id: g.id,
        title: g.title,
        category: g.category,
        percent,
        deadline: g.deadline ? g.deadline.toISOString().slice(0, 10) : null,
        behindDeadline: behind,
      };
    });

    return {
      weekStart,
      weekEnd: to7dLabels[to7dLabels.length - 1],
      schedule: {
        total: totalScheduleItems,
        completed: totalScheduleDone,
        completionPercent:
          totalScheduleItems > 0
            ? Math.round((totalScheduleDone / totalScheduleItems) * 100)
            : null,
        byDay: completionByDay,
      },
      tasks: {
        byStatus: Object.fromEntries(tasks.map((t) => [t.status, t._count._all])),
      },
      habits: {
        completed: habitsCompleted,
        target: habitsTarget,
        consistencyPercent:
          habitsTarget > 0 ? Math.round((habitsCompleted / habitsTarget) * 100) : null,
      },
      sleep: { averageMinutes: sleepAvg, entries: sleepLogs },
      mood: { entries: moodLogs },
      meals: { daysLogged: mealDays, total: meals.length },
      spending: {
        total: weekSpending,
        byCategory: spendingByCategory,
        byDay: spendByDay,
      },
      budgetWarnings,
      goalProgress,
    };
  }

  /**
   * YYYY-MM summary of a calendar month. Core numbers only — budget usage,
   * spending by category, debts, saving goals. AI-driven narrative layer is
   * POST /api/ai/analyze-finance.
   */
  async monthlyFinance(userId: string, month: string) {
    const { from, to } = monthBounds(month);
    const monthEnd = new Date(to.getTime() - 1);

    const [incomes, expenses, budgets, debts, savingGoals] = await Promise.all([
      this.prisma.income.findMany({
        where: { userId, incomeDate: { gte: from, lt: to } },
        select: { amount: true, category: true },
      }),
      this.prisma.expense.findMany({
        where: { userId, expenseDate: { gte: from, lt: to } },
        select: { amount: true, category: true, needLevel: true, expenseDate: true },
      }),
      this.prisma.budget.findMany({
        where: {
          userId,
          AND: [{ startDate: { lte: monthEnd } }, { endDate: { gte: from } }],
        },
        select: {
          id: true,
          category: true,
          amount: true,
          startDate: true,
          endDate: true,
          alertThresholdPercent: true,
          period: true,
        },
      }),
      this.prisma.debt.findMany({
        where: { userId, status: 'ACTIVE' },
        select: { id: true, type: true, title: true, totalAmount: true, paidAmount: true, dueDate: true, status: true },
      }),
      this.prisma.savingGoal.findMany({
        where: { userId, status: 'ACTIVE' },
        select: { id: true, title: true, targetAmount: true, currentAmount: true, targetDate: true, priority: true },
      }),
    ]);

    const totalIncome = incomes.reduce((s, i) => s + toNumber(i.amount), 0);
    const totalExpense = expenses.reduce((s, e) => s + toNumber(e.amount), 0);
    const saving = totalIncome - totalExpense;
    const savingRatePercent =
      totalIncome > 0 ? Math.round((saving / totalIncome) * 100) : null;

    const byCategory = expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + toNumber(e.amount);
      return acc;
    }, {});
    const byNeedLevel = expenses.reduce<Record<string, number>>((acc, e) => {
      const k = e.needLevel ?? 'UNKNOWN';
      acc[k] = (acc[k] ?? 0) + toNumber(e.amount);
      return acc;
    }, {});

    const budgetUsage = await Promise.all(
      budgets.map(async (b) => {
        const spent = await this.prisma.expense.aggregate({
          where: {
            userId,
            category: b.category,
            expenseDate: { gte: b.startDate, lte: b.endDate },
          },
          _sum: { amount: true },
        });
        const used = toNumber(spent._sum.amount);
        const usedPercent = toNumber(b.amount) > 0
          ? Math.round((used / toNumber(b.amount)) * 100)
          : 0;
        return {
          id: b.id,
          category: b.category,
          amount: toNumber(b.amount),
          used,
          usedPercent,
          overThreshold: usedPercent >= b.alertThresholdPercent,
        };
      }),
    );

    const debtSummary = {
      iOwe: debts
        .filter((d) => d.type === 'I_OWE')
        .reduce((s, d) => s + (toNumber(d.totalAmount) - toNumber(d.paidAmount)), 0),
      owedToMe: debts
        .filter((d) => d.type === 'OWED_TO_ME')
        .reduce((s, d) => s + (toNumber(d.totalAmount) - toNumber(d.paidAmount)), 0),
      items: debts.map((d) => ({
        id: d.id,
        type: d.type,
        title: d.title,
        remaining: toNumber(d.totalAmount) - toNumber(d.paidAmount),
        dueDate: d.dueDate ? d.dueDate.toISOString().slice(0, 10) : null,
        status: d.status,
      })),
    };

    const savingGoalSummary = savingGoals.map((g) => {
      const target = toNumber(g.targetAmount);
      const current = toNumber(g.currentAmount);
      const percent = target > 0 ? Math.round((current / target) * 100) : 0;
      return {
        id: g.id,
        title: g.title,
        target,
        current,
        percent,
        targetDate: g.targetDate ? g.targetDate.toISOString().slice(0, 10) : null,
        priority: g.priority,
      };
    });

    return {
      month,
      totals: {
        income: totalIncome,
        expense: totalExpense,
        saving,
        savingRatePercent,
      },
      byCategory,
      byNeedLevel,
      budgetUsage,
      debts: debtSummary,
      savingGoals: savingGoalSummary,
    };
  }

  /**
   * Cross-goal summary for ReportsScreen — buckets goals by status + shows
   * per-goal percent progress and whether the deadline has already slipped.
   */
  async goalProgress(userId: string) {
    const todayIso = new Date().toISOString().slice(0, 10);
    const goals = await this.prisma.personalGoal.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        category: true,
        priority: true,
        status: true,
        targetValue: true,
        currentValue: true,
        unit: true,
        deadline: true,
        milestones: { select: { id: true, status: true } },
      },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    });

    const shaped = goals.map((g) => {
      let percent: number | null = null;
      if (g.targetValue !== null && g.currentValue !== null && g.targetValue > 0) {
        percent = Math.max(0, Math.min(100, Math.round((g.currentValue / g.targetValue) * 100)));
      } else if (g.milestones.length > 0) {
        const done = g.milestones.filter((m) => m.status === 'COMPLETED').length;
        percent = Math.round((done / g.milestones.length) * 100);
      }
      const deadline = g.deadline ? g.deadline.toISOString().slice(0, 10) : null;
      const behindDeadline =
        deadline !== null && g.status === 'ACTIVE' && deadline < todayIso && (percent ?? 0) < 100;
      return {
        id: g.id,
        title: g.title,
        category: g.category,
        priority: g.priority,
        status: g.status,
        percent,
        milestones: {
          total: g.milestones.length,
          completed: g.milestones.filter((m) => m.status === 'COMPLETED').length,
        },
        deadline,
        behindDeadline,
      };
    });

    const byStatus = shaped.reduce<Record<string, number>>((acc, g) => {
      acc[g.status] = (acc[g.status] ?? 0) + 1;
      return acc;
    }, {});
    const averagePercent = (() => {
      const active = shaped.filter((g) => g.status === 'ACTIVE' && g.percent !== null);
      if (active.length === 0) return null;
      return Math.round(active.reduce((s, g) => s + (g.percent ?? 0), 0) / active.length);
    })();

    return {
      generatedAt: new Date().toISOString(),
      byStatus,
      averagePercent,
      behindCount: shaped.filter((g) => g.behindDeadline).length,
      goals: shaped,
    };
  }
}
