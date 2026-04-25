import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LocaleService } from '../../common/i18n/locale.service';
import { PrivacyService } from '../privacy/privacy.service';
import { WidgetPreferencesService } from './widget-preferences.service';
import { toWidgetPreferencesDto } from './dto';
import type {
  WidgetFinanceSummaryDto,
  WidgetHealthSummaryDto,
  WidgetSummaryDto,
} from '@planner/shared';

const GREETING = {
  vi: { morning: 'Chào buổi sáng', afternoon: 'Chào buổi chiều', evening: 'Chào buổi tối' },
  en: { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' },
};

/**
 * Builds the widget summary the mobile app caches into MMKV/AsyncStorage
 * and the iOS / Android native widget reads from disk. Privacy posture:
 *
 *   1. Composite gate: widget-prefs `enabled` is the master. When false,
 *      we still respond (so the toggle works) but mark every section
 *      empty so the snapshot the mobile keeps cached is harmless.
 *   2. PrivacySetting AI-domain gates ALSO clip context: if the user
 *      revoked finance for AI, finance widget disappears too — same
 *      privacy contract as the rest of the app.
 *   3. Finance amounts are stripped at the SHAPE level (field absent),
 *      not the value level. The widget cannot leak a number that isn't
 *      in the JSON.
 *   4. MINIMAL privacy mode collapses health + recommendation entirely.
 *
 * Output is ALWAYS safe to render on a lock-screen widget per the
 * user's own preferences.
 */
@Injectable()
export class WidgetSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locale: LocaleService,
    private readonly privacy: PrivacyService,
    private readonly preferences: WidgetPreferencesService,
  ) {}

  async build(userId: string): Promise<WidgetSummaryDto> {
    const [prefs, gates, localeTag] = await Promise.all([
      this.preferences.get(userId),
      this.privacy.aiGates(userId),
      this.locale.forUser(userId, {}),
    ]);
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday.getTime() + 86_400_000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const greeting = pickGreeting(now.getHours(), localeTag);

    // When widget master switch is OFF, return an empty-but-shaped doc so
    // the mobile MMKV snapshot is harmless. Don't query anything.
    if (!prefs.enabled) {
      return {
        preferences: toWidgetPreferencesDto(prefs),
        locale: localeTag,
        today: {
          greeting,
          pendingTaskCount: 0,
          meals: { breakfast: false, lunch: false, dinner: false },
        },
        nextTask: null,
        nextScheduleItem: null,
        widgetUpdatedAt: now.toISOString(),
      };
    }

    // ---- Tasks (gated by widget pref AND personalization tasks gate) -----
    const showTasks = prefs.showTasks && gates.tasks;
    const [pendingTasks, nextTaskRow] = showTasks
      ? await Promise.all([
          this.prisma.task.count({
            where: { userId, deletedAt: null, status: { in: ['TODO', 'IN_PROGRESS'] } },
          }),
          this.prisma.task.findFirst({
            where: { userId, deletedAt: null, status: { in: ['TODO', 'IN_PROGRESS'] } },
            orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'asc' }],
            select: { id: true, title: true, dueDate: true, priority: true },
          }),
        ])
      : [0, null];

    // ---- Schedule item (next upcoming today) -----------------------------
    const showSchedule = gates.schedule;
    const nextScheduleRow = showSchedule
      ? await this.prisma.scheduleItem.findFirst({
          where: { userId, startTime: { gte: now, lt: endOfToday } },
          orderBy: { startTime: 'asc' },
          select: { id: true, title: true, startTime: true, endTime: true, type: true },
        })
      : null;

    // ---- Today's meals + mood (gated by meal/health) ---------------------
    const showMeals = gates.meals;
    const todayMealRows = showMeals
      ? await this.prisma.mealLog.findMany({
          where: { userId, date: { gte: startOfToday, lt: endOfToday } },
          select: { mealType: true },
        })
      : [];
    const meals = {
      breakfast: todayMealRows.some((m) => m.mealType === 'BREAKFAST'),
      lunch: todayMealRows.some((m) => m.mealType === 'LUNCH'),
      dinner: todayMealRows.some((m) => m.mealType === 'DINNER'),
    };

    // ---- Top recommendation (only when allowed) --------------------------
    const showRec = prefs.showRecommendations && prefs.privacyMode !== 'MINIMAL';
    const topRec = showRec
      ? await this.prisma.aIRecommendation.findFirst({
          where: { userId, status: { in: ['NEW', 'VIEWED'] } },
          orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
          select: { id: true, type: true, title: true, content: true, priority: true },
        })
      : null;

    // ---- Finance (gated by pref + finance-AI gate; amounts gated separately) ----
    const showFinance = prefs.showFinance && gates.finance;
    let finance: WidgetFinanceSummaryDto | undefined;
    if (showFinance) {
      const [profile, walletAgg, monthIncomes, monthExpenses, budgets, savingGoal] =
        await Promise.all([
          this.prisma.userProfile.findUnique({
            where: { userId },
            select: { currency: true },
          }),
          this.prisma.wallet.aggregate({
            where: { userId, deletedAt: null },
            _sum: { balance: true },
          }),
          this.prisma.income.aggregate({
            where: { userId, deletedAt: null, incomeDate: { gte: monthStart, lt: monthEnd } },
            _sum: { amount: true },
          }),
          this.prisma.expense.findMany({
            where: { userId, deletedAt: null, expenseDate: { gte: monthStart, lt: monthEnd } },
            select: { category: true, amount: true },
          }),
          this.prisma.budget.findMany({
            where: { userId, deletedAt: null },
            select: { category: true, amount: true, alertThresholdPercent: true },
          }),
          this.prisma.savingGoal.findFirst({
            where: { userId, deletedAt: null, status: 'ACTIVE' },
            orderBy: { priority: 'desc' },
            select: { targetAmount: true, currentAmount: true },
          }),
        ]);
      const currency = profile?.currency ?? 'VND';
      const totalIncome = Number(monthIncomes._sum.amount ?? 0);
      const totalExpense = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);
      void walletAgg; // reserved for v1.3 multi-wallet rollup
      const remaining = totalIncome - totalExpense;

      const sumByCategory = new Map<string, number>();
      for (const e of monthExpenses) {
        sumByCategory.set(e.category, (sumByCategory.get(e.category) ?? 0) + Number(e.amount));
      }
      const budgetWarnings = budgets
        .map((b) => {
          const spent = sumByCategory.get(b.category) ?? 0;
          const usagePercent = Number(b.amount) > 0 ? (spent / Number(b.amount)) * 100 : 0;
          return { category: b.category, usagePercent, threshold: b.alertThresholdPercent ?? 80 };
        })
        .filter((b) => b.usagePercent >= b.threshold)
        .map(({ category, usagePercent }) => ({ category, usagePercent }));

      const savingProgressPercent = savingGoal
        ? Math.min(100, (Number(savingGoal.currentAmount) / Number(savingGoal.targetAmount)) * 100)
        : null;

      const allowAmounts = prefs.showFinanceAmounts && prefs.privacyMode === 'FULL';
      finance = {
        currency,
        ...(allowAmounts ? { amounts: { totalIncome, totalExpense, remaining } } : {}),
        budgetWarnings,
        savingProgressPercent,
      };
    }

    // ---- Health (gated by pref + health-AI gate; collapsed in MINIMAL) ---
    const showHealth =
      prefs.showHealthData && gates.health && prefs.privacyMode !== 'MINIMAL';
    let health: WidgetHealthSummaryDto | undefined;
    if (showHealth) {
      const [sleep, mood] = await Promise.all([
        this.prisma.sleepLog.findFirst({
          where: { userId },
          orderBy: { date: 'desc' },
          select: { durationMinutes: true },
        }),
        this.prisma.moodLog.findFirst({
          where: { userId, date: { gte: startOfToday, lt: endOfToday } },
          orderBy: { date: 'desc' },
          select: { mood: true, energyLevel: true },
        }),
      ]);
      health = {
        sleepMinutes: sleep?.durationMinutes ?? null,
        mood: mood?.mood ?? null,
        energy: mood?.energyLevel ?? null,
        hasCheckinToday: !!mood,
      };
    }

    return {
      preferences: toWidgetPreferencesDto(prefs),
      locale: localeTag,
      today: { greeting, pendingTaskCount: pendingTasks, meals },
      nextTask: nextTaskRow
        ? {
            id: nextTaskRow.id,
            title: nextTaskRow.title.slice(0, 80),
            dueAt: nextTaskRow.dueDate?.toISOString() ?? null,
            priority: nextTaskRow.priority,
          }
        : null,
      nextScheduleItem: nextScheduleRow
        ? {
            id: nextScheduleRow.id,
            title: nextScheduleRow.title.slice(0, 80),
            startTime: nextScheduleRow.startTime.toISOString(),
            endTime: nextScheduleRow.endTime.toISOString(),
            type: nextScheduleRow.type,
          }
        : null,
      ...(topRec
        ? {
            topRecommendation: {
              id: topRec.id,
              type: topRec.type,
              title: topRec.title.slice(0, 80),
              content: topRec.content.slice(0, 200),
              priority: topRec.priority,
            },
          }
        : {}),
      ...(finance ? { finance } : {}),
      ...(health ? { health } : {}),
      widgetUpdatedAt: now.toISOString(),
    };
  }
}

function pickGreeting(hour: number, locale: 'vi' | 'en'): string {
  if (hour < 11) return GREETING[locale].morning;
  if (hour < 17) return GREETING[locale].afternoon;
  return GREETING[locale].evening;
}
