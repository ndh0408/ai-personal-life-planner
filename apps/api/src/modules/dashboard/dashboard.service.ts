import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LocaleService } from '../../common/i18n/locale.service';
import { serialiseMoney, sumMoney } from '../../common/finance/money';
import { getUserDayBounds } from '../../common/datetime/day-bounds';
import { DailyMonitoringService } from '../assistant/services/daily-monitoring.service';
import { LifeInsightService } from '../assistant/services/life-insight.service';
import { RecommendationService } from '../assistant/services/recommendation.service';

type RequestLike = { headers?: Record<string, string | string[] | undefined>; locale?: string };

function dayBounds(yyyyMmDd: string): { start: Date; end: Date } {
  const start = new Date(`${yyyyMmDd}T00:00:00.000Z`);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

function monthBounds(today: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
  return { start, end };
}

function weekAgo(from: Date): Date {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - 7);
  return d;
}

/**
 * Aggregates the home-screen payload in a single request so the mobile
 * dashboard doesn't fan out to 10 endpoints on mount.
 *
 *   - All counters + sums run in a single prisma.$transaction batch.
 *   - The top recommendation is picked from the assistant's live feed.
 *   - Budget usage is computed from this month's expenses, mirroring
 *     BudgetsService (authoritative expense table wins over any denormalized
 *     counter).
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locale: LocaleService,
    private readonly monitoring: DailyMonitoringService,
    private readonly insights: LifeInsightService,
    private readonly recs: RecommendationService,
  ) {}

  async summary(userId: string, dateStr: string, req: RequestLike) {
    const localeTag = await this.locale.forUser(userId, req);
    const day = dayBounds(dateStr);
    const now = new Date();
    const month = monthBounds(day.start);
    const last7 = weekAgo(day.end);
    // Round-14 timezone-aware window for TIMESTAMP columns (task.dueDate).
    // DATE-only columns (`schedule.date`, mood/sleep/meal/habit) keep using
    // `day` since the YYYY-MM-DD wall-clock matches the DB DATE value.
    const profileTz = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    const tzWindow = getUserDayBounds(dateStr, profileTz?.timezone ?? 'UTC');

    const [
      user,
      profile,
      schedule,
      tasksDueToday,
      tasksOverdue,
      tasksHighPriorityOpen,
      habits,
      habitLogsToday,
      mealPlanToday,
      mealLogsToday,
      sleepLatest,
      moodToday,
      walletsAll,
      incomesMonth,
      expensesMonth,
      budgets,
      personalGoals,
      savingGoals,
    ] = await this.prisma.$transaction([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true, email: true },
      }),
      this.prisma.userProfile.findUnique({
        where: { userId },
        select: { fullName: true, currency: true, monthlySalary: true },
      }),
      this.prisma.dailySchedule.findFirst({
        where: { userId, date: day.start },
        include: { items: { select: { id: true, status: true } } },
      }),
      this.prisma.task.findMany({
        where: { userId, deletedAt: null, dueDate: { gte: tzWindow.from, lt: tzWindow.to } },
        select: { id: true, title: true, status: true, priority: true },
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
        take: 5,
      }),
      this.prisma.task.count({
        where: {
          userId,
          deletedAt: null,
          status: { in: ['TODO', 'IN_PROGRESS'] },
          dueDate: { lt: tzWindow.from, not: null },
        },
      }),
      this.prisma.task.count({
        where: {
          userId,
          deletedAt: null,
          status: { in: ['TODO', 'IN_PROGRESS'] },
          priority: 'HIGH',
        },
      }),
      this.prisma.habit.findMany({
        where: { userId, deletedAt: null, isActive: true },
        select: { id: true, name: true },
      }),
      this.prisma.habitLog.findMany({
        where: { userId, date: day.start },
        select: { habitId: true, completed: true },
      }),
      this.prisma.mealPlan.findFirst({
        where: { userId, date: day.start },
        include: { suggestions: { select: { mealType: true, title: true } } },
      }),
      this.prisma.mealLog.findMany({
        where: { userId, date: day.start },
        select: { mealType: true, title: true },
      }),
      this.prisma.sleepLog.findFirst({
        where: { userId },
        orderBy: { date: 'desc' },
        select: { date: true, durationMinutes: true, quality: true },
      }),
      this.prisma.moodLog.findFirst({
        where: { userId, date: day.start },
        select: { mood: true, energyLevel: true, stressLevel: true },
      }),
      this.prisma.wallet.findMany({
        where: { userId, deletedAt: null },
        select: { id: true, name: true, balance: true, currency: true, isActive: true },
      }),
      this.prisma.income.findMany({
        where: { userId, deletedAt: null, incomeDate: { gte: month.start, lt: month.end } },
        select: { amount: true, currency: true },
      }),
      this.prisma.expense.findMany({
        where: { userId, deletedAt: null, expenseDate: { gte: month.start, lt: month.end } },
        select: { amount: true, category: true, currency: true },
      }),
      this.prisma.budget.findMany({ where: { userId, deletedAt: null } }),
      this.prisma.personalGoal.findMany({
        where: { userId, deletedAt: null, status: 'ACTIVE' },
        select: {
          id: true,
          title: true,
          category: true,
          targetValue: true,
          currentValue: true,
          deadline: true,
        },
      }),
      this.prisma.savingGoal.findMany({
        where: { userId, deletedAt: null, status: 'ACTIVE' },
        select: {
          id: true,
          title: true,
          targetAmount: true,
          currentAmount: true,
          targetDate: true,
        },
      }),
    ]);

    // Top recommendation — priority DESC then most recent.
    const topRec = await this.prisma.aIRecommendation.findFirst({
      where: { userId, status: { in: ['NEW', 'VIEWED'] } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        type: true,
        title: true,
        content: true,
        priority: true,
        createdAt: true,
      },
    });

    const primaryCurrency = (profile?.currency ?? 'VND').toUpperCase();

    // ---- Schedule rollup ----------------------------------------------------
    const items = schedule?.items ?? [];
    const scheduleItems = items.length;
    const scheduleCompleted = items.filter((i) => i.status === 'COMPLETED').length;

    // ---- Task rollup --------------------------------------------------------
    const tasksTodayCompleted = tasksDueToday.filter((t) => t.status === 'COMPLETED').length;
    const tasksTodayPending = tasksDueToday.length - tasksTodayCompleted;

    // ---- Habit rollup -------------------------------------------------------
    const habitsCompleted = habitLogsToday.filter((l) => l.completed).length;
    const habitsActive = habits.length;

    // ---- Finance rollup -----------------------------------------------------
    // Round-13: aggregate ONLY rows in the user's primary currency. Multi-
    // currency users still get per-currency wallet sums (see walletBalances)
    // so they don't lose visibility into other-currency holdings — they just
    // never see meaningless mixed totals.
    const incomesPrimary = incomesMonth.filter((r) => r.currency === primaryCurrency);
    const expensesPrimary = expensesMonth.filter((r) => r.currency === primaryCurrency);
    const totalIncomeDec = sumMoney(incomesPrimary.map((r) => r.amount));
    const totalExpenseDec = sumMoney(expensesPrimary.map((r) => r.amount));
    const remainingDec = totalIncomeDec.minus(totalExpenseDec);

    // Per-currency wallet balances. The legacy `totalCash` is kept for
    // backwards compatibility and is the primary-currency total only.
    const walletBalances: Record<string, string> = {};
    for (const w of walletsAll) {
      const cur = (w.currency ?? primaryCurrency).toUpperCase();
      const cur_total = walletBalances[cur]
        ? new Prisma.Decimal(walletBalances[cur]).plus(w.balance)
        : new Prisma.Decimal(w.balance);
      walletBalances[cur] = cur_total.toFixed(2);
    }
    const totalCashDec = walletsAll
      .filter((w) => (w.currency ?? primaryCurrency).toUpperCase() === primaryCurrency)
      .reduce<Prisma.Decimal>(
        (acc, w) => acc.plus(w.balance),
        new Prisma.Decimal(0),
      );

    const mixedCurrencyDetected =
      Object.keys(walletBalances).length > 1 ||
      incomesMonth.some((r) => r.currency !== primaryCurrency) ||
      expensesMonth.some((r) => r.currency !== primaryCurrency);

    // Budget warnings — match category AND currency (a USD budget never
    // counts VND expenses).
    const budgetSpentByKey = new Map<string, Prisma.Decimal>();
    for (const e of expensesMonth) {
      const k = `${e.category}|${e.currency}`;
      budgetSpentByKey.set(
        k,
        (budgetSpentByKey.get(k) ?? new Prisma.Decimal(0)).plus(e.amount),
      );
    }
    const budgetWarnings = budgets
      .map((b) => {
        const cur = (b as { currency?: string }).currency ?? primaryCurrency;
        const k = `${b.category}|${cur}`;
        const spent = budgetSpentByKey.get(k) ?? new Prisma.Decimal(0);
        const amt = new Prisma.Decimal(b.amount);
        const pct = amt.isZero() ? 0 : Number(spent.times(100).dividedBy(amt).toFixed(2));
        return {
          category: b.category,
          currency: cur,
          amount: serialiseMoney(amt),
          spent: serialiseMoney(spent),
          usedPercent: Math.round(pct),
          overThreshold: pct >= b.alertThresholdPercent,
        };
      })
      .filter((b) => b.overThreshold)
      .sort((a, b) => b.usedPercent - a.usedPercent)
      .slice(0, 3);

    // ---- Goals rollup -------------------------------------------------------
    const goalsTotal = personalGoals.length;
    const goalsBehind = personalGoals.filter((g) => {
      if (!g.targetValue || g.currentValue === null || !g.deadline) return false;
      const daysLeft = Math.round((g.deadline.getTime() - now.getTime()) / 86_400_000);
      const pct = g.targetValue > 0 ? (g.currentValue / g.targetValue) * 100 : 0;
      return daysLeft > 0 && daysLeft < 60 && pct < 40;
    }).length;

    const topSavingGoal = [...savingGoals]
      .map((g) => ({
        id: g.id,
        title: g.title,
        target: Number(g.targetAmount),
        current: Number(g.currentAmount),
        targetDate: g.targetDate,
      }))
      .sort((a, b) => b.target / (1 + b.current) - a.target / (1 + a.current))[0] ?? null;

    const scores = await this.insights.score(userId, dateStr);

    return {
      date: dateStr,
      locale: localeTag,
      greeting: {
        displayName: profile?.fullName || user?.displayName || '',
      },
      assistantHighlight: topRec,
      todayPlan: {
        hasSchedule: !!schedule,
        scheduleId: schedule?.id ?? null,
        items: scheduleItems,
        completed: scheduleCompleted,
        scheduleStatus: schedule?.status ?? null,
      },
      finance: {
        currency: primaryCurrency,
        monthlySalary:
          profile?.monthlySalary !== null && profile?.monthlySalary !== undefined
            ? serialiseMoney(profile.monthlySalary)
            : null,
        // Numeric fields stay numeric for the existing mobile JSON parser;
        // they represent the primary-currency-only sums (round-13 fix).
        totalIncome: Number(totalIncomeDec.toFixed(2)),
        totalExpense: Number(totalExpenseDec.toFixed(2)),
        remaining: Number(remainingDec.toFixed(2)),
        totalCash: Number(totalCashDec.toFixed(2)),
        walletsCount: walletsAll.length,
        // Per-currency wallet totals — mobile renders a "+ USD 50.00" badge
        // when this map has more than one entry.
        walletBalances,
        mixedCurrencyDetected,
        budgetWarnings,
      },
      health: {
        sleepLatest: sleepLatest
          ? {
              date: sleepLatest.date.toISOString().slice(0, 10),
              durationMinutes: sleepLatest.durationMinutes,
              quality: sleepLatest.quality,
            }
          : null,
        moodToday,
        meals: {
          planned: mealPlanToday?.suggestions.length ?? 0,
          logged: mealLogsToday.length,
          nextPlanned: mealPlanToday?.suggestions[mealLogsToday.length]?.title ?? null,
        },
        habits: { active: habitsActive, completed: habitsCompleted, logged: habitLogsToday.length },
      },
      tasks: {
        todayTotal: tasksDueToday.length,
        todayCompleted: tasksTodayCompleted,
        todayPending: tasksTodayPending,
        overdue: tasksOverdue,
        highPriorityOpen: tasksHighPriorityOpen,
        top: tasksDueToday.slice(0, 3).map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
        })),
      },
      goals: {
        activeTotal: goalsTotal,
        behind: goalsBehind,
        topSaving: topSavingGoal,
      },
      scores,
    };
  }
}
