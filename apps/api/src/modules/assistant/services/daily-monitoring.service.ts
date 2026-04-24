import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { Signal } from './types';

function dayBounds(yyyyMmDd: string): { start: Date; end: Date } {
  const start = new Date(`${yyyyMmDd}T00:00:00.000Z`);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

function daysAgo(n: number, from: Date = new Date()): Date {
  return new Date(from.getTime() - n * 86_400_000);
}

function daysLeftInMonth(today: Date): number {
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0, 23, 59, 59));
  return Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86_400_000));
}

function monthBounds(today: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
  return { start, end };
}

/**
 * Reads the user's day + recent history and emits stable-coded signals.
 *
 * Pure function over data — never writes. The caller (ProactiveNudgeService)
 * decides which signals deserve a recommendation / notification.
 */
@Injectable()
export class DailyMonitoringService {
  constructor(private readonly prisma: PrismaService) {}

  async collect(userId: string, date: string): Promise<Signal[]> {
    const today = dayBounds(date);
    const signals: Signal[] = [];

    const [
      profile,
      schedule,
      tasksDueSoon,
      tasksOverdue,
      habits,
      habitLogsToday,
      habitLogsRecent,
      mealPlan,
      mealLogsRecent,
      sleepToday,
      sleepRecent,
      moodToday,
      moodRecent,
      expensesToday,
      expensesMonth,
      budgets,
      debts,
      savingGoals,
      personalGoals,
    ] = await Promise.all([
      this.prisma.userProfile.findUnique({ where: { userId } }),
      this.prisma.dailySchedule.findFirst({
        where: { userId, date: today.start },
        include: { items: true },
      }),
      this.prisma.task.findMany({
        where: {
          userId,
          status: { in: ['TODO', 'IN_PROGRESS'] },
          dueDate: { gte: today.start, lt: new Date(today.end.getTime() + 2 * 86_400_000) },
        },
      }),
      this.prisma.task.findMany({
        where: {
          userId,
          status: { in: ['TODO', 'IN_PROGRESS'] },
          dueDate: { lt: today.start, not: null },
        },
      }),
      this.prisma.habit.findMany({ where: { userId, isActive: true } }),
      this.prisma.habitLog.findMany({ where: { userId, date: today.start } }),
      this.prisma.habitLog.findMany({
        where: { userId, date: { gte: daysAgo(7, today.start), lt: today.end } },
      }),
      this.prisma.mealPlan.findFirst({ where: { userId, date: today.start } }),
      this.prisma.mealLog.findMany({
        where: { userId, date: { gte: daysAgo(5, today.start), lt: today.end } },
      }),
      this.prisma.sleepLog.findFirst({ where: { userId, date: today.start } }),
      this.prisma.sleepLog.findMany({
        where: { userId, date: { gte: daysAgo(5, today.start), lt: today.end } },
        orderBy: { date: 'desc' },
      }),
      this.prisma.moodLog.findFirst({ where: { userId, date: today.start } }),
      this.prisma.moodLog.findMany({
        where: { userId, date: { gte: daysAgo(5, today.start), lt: today.end } },
      }),
      this.prisma.expense.findMany({
        where: { userId, expenseDate: { gte: today.start, lt: today.end } },
      }),
      (async () => {
        const m = monthBounds(today.start);
        return this.prisma.expense.findMany({
          where: { userId, expenseDate: { gte: m.start, lt: m.end } },
        });
      })(),
      this.prisma.budget.findMany({ where: { userId } }),
      this.prisma.debt.findMany({ where: { userId, status: 'ACTIVE' } }),
      this.prisma.savingGoal.findMany({ where: { userId, status: 'ACTIVE' } }),
      this.prisma.personalGoal.findMany({ where: { userId, status: 'ACTIVE' } }),
    ]);

    // ---- Schedule ------------------------------------------------------------
    if (!schedule) {
      signals.push({ code: 'SCHEDULE_MISSING', severity: 'MEDIUM', payload: { date } });
    } else {
      const items = schedule.items;
      if (items.length >= 10) {
        signals.push({
          code: 'SCHEDULE_OVERLOADED',
          severity: 'MEDIUM',
          payload: { date, itemsCount: items.length },
        });
      }
      // "Behind" = current time past some PENDING items' startTime
      const now = new Date();
      const behind = items.filter(
        (i) => i.status === 'PENDING' && i.startTime.getTime() < now.getTime(),
      );
      if (behind.length >= 2) {
        signals.push({
          code: 'SCHEDULE_BEHIND',
          severity: 'HIGH',
          payload: { date, pendingPastCount: behind.length },
        });
      }
      // Free window detection: any gap >= 120 min between items
      const sorted = [...items].sort(
        (a, b) => a.startTime.getTime() - b.startTime.getTime(),
      );
      for (let i = 1; i < sorted.length; i++) {
        const gapMin = (sorted[i].startTime.getTime() - sorted[i - 1].endTime.getTime()) / 60_000;
        if (gapMin >= 120) {
          signals.push({
            code: 'SCHEDULE_FREE_WINDOW',
            severity: 'LOW',
            payload: {
              date,
              gapMinutes: Math.round(gapMin),
              startIso: sorted[i - 1].endTime.toISOString(),
            },
          });
          break;
        }
      }
    }

    // ---- Tasks ---------------------------------------------------------------
    if (tasksOverdue.length > 0) {
      signals.push({
        code: 'TASK_OVERDUE',
        severity: 'HIGH',
        payload: {
          count: tasksOverdue.length,
          sample: tasksOverdue.slice(0, 3).map((t) => ({ id: t.id, title: t.title })),
        },
      });
    }
    if (tasksDueSoon.length > 0) {
      signals.push({
        code: 'TASKS_DUE_SOON',
        severity: 'MEDIUM',
        payload: {
          count: tasksDueSoon.length,
          sample: tasksDueSoon.slice(0, 3).map((t) => ({ id: t.id, title: t.title })),
        },
      });
    }

    // ---- Habits --------------------------------------------------------------
    if (habits.length > 0) {
      const loggedIds = new Set(habitLogsToday.map((l) => l.habitId));
      const notLogged = habits.filter((h) => !loggedIds.has(h.id));
      if (notLogged.length === habits.length && habits.length >= 2) {
        signals.push({
          code: 'HABITS_NOT_LOGGED',
          severity: 'LOW',
          payload: { date, habitCount: habits.length },
        });
      }
      // "Dropping" — a daily habit not completed for 3+ of the last 5 days
      for (const h of habits) {
        if (h.frequency !== 'DAILY') continue;
        const last5 = habitLogsRecent.filter(
          (l) =>
            l.habitId === h.id &&
            l.date.getTime() >= daysAgo(5, today.start).getTime(),
        );
        const completed = last5.filter((l) => l.completed).length;
        if (completed <= 2) {
          signals.push({
            code: 'HABIT_DROPPING',
            severity: 'MEDIUM',
            payload: { habitId: h.id, name: h.name, completedLast5: completed },
          });
        }
      }
    }

    // ---- Meals ---------------------------------------------------------------
    if (!mealPlan) {
      signals.push({ code: 'MEAL_PLAN_MISSING', severity: 'LOW', payload: { date } });
    }
    if (mealLogsRecent.length < 5) {
      // < ~1 meal/day logged across 5 days
      signals.push({
        code: 'MEAL_SKIPPED_REPEATEDLY',
        severity: 'MEDIUM',
        payload: { loggedLast5: mealLogsRecent.length },
      });
    }

    // ---- Sleep + mood --------------------------------------------------------
    if (!sleepToday) {
      signals.push({ code: 'SLEEP_CHECKIN_MISSING', severity: 'LOW', payload: { date } });
    }
    if (!moodToday) {
      signals.push({ code: 'MOOD_CHECKIN_MISSING', severity: 'LOW', payload: { date } });
    }
    if (sleepRecent.length >= 3) {
      const avg = sleepRecent.reduce((s, l) => s + l.durationMinutes, 0) / sleepRecent.length;
      if (avg < 6 * 60) {
        signals.push({
          code: 'UNDER_SLEPT_3D',
          severity: 'HIGH',
          payload: { avgMinutes: Math.round(avg), samples: sleepRecent.length },
        });
      }
    }
    if (moodRecent.length >= 3) {
      const stressed = moodRecent.filter((m) => m.stressLevel === 'HIGH').length;
      if (stressed >= 2) {
        signals.push({
          code: 'STRESS_HIGH_RECURRING',
          severity: 'MEDIUM',
          payload: { highStressDays: stressed, window: moodRecent.length },
        });
      }
    }

    // ---- Finance -------------------------------------------------------------
    for (const b of budgets) {
      const periodStart = b.startDate;
      const periodEnd = b.endDate;
      const spent = expensesMonth
        .filter(
          (e) =>
            e.category === b.category &&
            e.expenseDate.getTime() >= periodStart.getTime() &&
            e.expenseDate.getTime() <= periodEnd.getTime(),
        )
        .reduce((s, e) => s + Number(e.amount), 0);
      const pct = Number(b.amount) === 0 ? 0 : (spent / Number(b.amount)) * 100;
      if (pct >= b.alertThresholdPercent) {
        signals.push({
          code: 'BUDGET_OVER_THRESHOLD',
          severity: pct >= 100 ? 'HIGH' : 'MEDIUM',
          payload: {
            budgetId: b.id,
            category: b.category,
            usagePercent: Math.round(pct),
            spent,
            cap: Number(b.amount),
          },
        });
      }
    }
    if (expensesToday.length > 0) {
      const todayTotal = expensesToday.reduce((s, e) => s + Number(e.amount), 0);
      const avgDaily = monthAvgDaily(expensesMonth, today.start);
      if (avgDaily > 0 && todayTotal > avgDaily * 2 && todayTotal > 200_000) {
        signals.push({
          code: 'SPENDING_ABOVE_BASELINE',
          severity: 'MEDIUM',
          payload: { todayTotal, avgDaily: Math.round(avgDaily) },
        });
      }
    }

    // Debt due soon (within 7 days)
    for (const d of debts) {
      if (!d.dueDate) continue;
      const daysTo = Math.round((d.dueDate.getTime() - today.start.getTime()) / 86_400_000);
      if (daysTo >= 0 && daysTo <= 7) {
        signals.push({
          code: 'DEBT_DUE_SOON',
          severity: 'HIGH',
          payload: {
            debtId: d.id,
            title: d.title,
            daysTo,
            remaining: Number(d.totalAmount) - Number(d.paidAmount),
          },
        });
      }
    }

    // Cash-low vs days left in month
    if (profile) {
      const monthExpenseSoFar = expensesMonth.reduce((s, e) => s + Number(e.amount), 0);
      const salary = profile.monthlySalary ? Number(profile.monthlySalary) : 0;
      const remaining = salary - monthExpenseSoFar;
      const left = daysLeftInMonth(today.start);
      if (salary > 0 && left > 0 && remaining < (salary / 30) * left * 0.5) {
        signals.push({
          code: 'CASH_LOW_VS_DAYS_LEFT',
          severity: 'HIGH',
          payload: { remaining, daysLeft: left, salary },
        });
      }
    }

    // ---- Goals ---------------------------------------------------------------
    for (const g of savingGoals) {
      const target = Number(g.targetAmount);
      const current = Number(g.currentAmount);
      const pct = target > 0 ? (current / target) * 100 : 0;
      if (g.targetDate) {
        const daysTo = Math.round((g.targetDate.getTime() - today.start.getTime()) / 86_400_000);
        if (daysTo > 0 && daysTo < 90 && pct < 40) {
          signals.push({
            code: 'FIN_GOAL_BEHIND',
            severity: 'MEDIUM',
            payload: { goalId: g.id, title: g.title, progressPercent: Math.round(pct), daysTo },
          });
        }
      }
    }
    for (const g of personalGoals) {
      if (!g.deadline || g.targetValue === null || g.currentValue === null) continue;
      const daysTo = Math.round((g.deadline.getTime() - today.start.getTime()) / 86_400_000);
      const pct = g.targetValue > 0 ? (g.currentValue / g.targetValue) * 100 : 0;
      if (daysTo > 0 && daysTo < 30 && pct < 40) {
        signals.push({
          code: 'PERSONAL_GOAL_BEHIND',
          severity: 'MEDIUM',
          payload: {
            goalId: g.id,
            title: g.title,
            progressPercent: Math.round(pct),
            daysTo,
          },
        });
      }
    }

    return signals;
  }
}

function monthAvgDaily(expenses: Array<{ amount: unknown; expenseDate: Date }>, today: Date): number {
  if (expenses.length === 0) return 0;
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const dayCount = Math.max(
    1,
    Math.round((today.getTime() - monthStart.getTime()) / 86_400_000),
  );
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  return total / dayCount;
}
