import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LocaleService } from '../../../common/i18n/locale.service';
import { AiProviderService } from './ai-provider.service';
import { AiPromptTemplateService } from './ai-prompt-template.service';
import { AiJsonValidationService } from './ai-json-validation.service';
import { AiHealthService } from './ai-health.service';
import { AiGoalService } from './ai-goal.service';
import { DailyReviewSchema, type DailyReviewOutput } from '../schemas/daily-review.schema';
import {
  buildDailyReviewPrompt,
  buildDailyReviewSystem,
  type DailyReviewContext,
} from '../prompts/daily-review.prompt';

export interface DailyReviewInput {
  date: string; // YYYY-MM-DD
}

type RequestLike = { headers?: Record<string, string | string[] | undefined>; locale?: string };

function dayBounds(yyyyMmDd: string): { start: Date; end: Date } {
  const start = new Date(`${yyyyMmDd}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 86_400_000);
  return { start, end };
}

function fallback(locale: 'vi' | 'en'): DailyReviewOutput {
  if (locale === 'en') {
    return {
      todaySummary: 'Daily review unavailable right now — using a safe template. Try again shortly.',
      wins: [],
      issues: [],
      suggestionsForTomorrow: ['Keep sleep window consistent.', 'Plan one deep-work block.'],
      healthAdvice: 'Prioritize sleep and a short walk after lunch.',
      financeAdvice: 'Log today\'s expenses if you haven\'t; it only takes a minute.',
      productivityAdvice: 'Pick your top one-hour task for tomorrow and calendar it.',
    };
  }
  return {
    todaySummary: 'Đánh giá ngày chưa sẵn sàng — đang dùng mẫu an toàn. Bạn thử lại sau nhé.',
    wins: [],
    issues: [],
    suggestionsForTomorrow: ['Giữ khung giờ ngủ đều.', 'Lên sẵn 1 khối deep-work.'],
    healthAdvice: 'Ưu tiên ngủ đủ và đi bộ nhẹ sau bữa trưa.',
    financeAdvice: 'Nếu chưa ghi chi tiêu hôm nay, hãy ghi nhanh — chỉ mất 1 phút.',
    productivityAdvice: 'Chọn 1 task quan trọng nhất cho ngày mai và đưa vào lịch.',
  };
}

@Injectable()
export class AiDailyReviewService {
  private readonly logger = new Logger(AiDailyReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: AiProviderService,
    private readonly tpl: AiPromptTemplateService,
    private readonly json: AiJsonValidationService,
    private readonly locale: LocaleService,
    private readonly health: AiHealthService,
    private readonly goal: AiGoalService,
  ) {}

  async review(userId: string, input: DailyReviewInput, req: RequestLike) {
    const locale = await this.locale.forUser(userId, req);
    const ctx = await this.collect(userId, input.date);

    const system = buildDailyReviewSystem(locale);
    const prompt = buildDailyReviewPrompt(this.tpl, ctx);

    let review: DailyReviewOutput;
    let usedFallback = false;
    try {
      const completion = await this.provider.complete({
        system,
        prompt,
        jsonMode: true,
        maxTokens: 1800,
        temperature: 0.4,
      });
      review = await this.json.parseAndValidate(completion.text, DailyReviewSchema, {
        task: 'daily-review',
        system,
      });
    } catch (e) {
      this.logger.warn(`daily-review fell back: ${e instanceof Error ? e.message : e}`);
      review = fallback(locale);
      usedFallback = true;
    }

    // Safety-net: if the health advisory tripped on unsafe content, replace.
    if (this.health.screenForUnsafeContent(review.healthAdvice)) {
      review.healthAdvice = this.health.safeFallback(locale);
    }

    const saved = await this.persist(userId, input.date, review);
    return { review, saved, locale, usedFallback };
  }

  private async collect(userId: string, date: string): Promise<DailyReviewContext> {
    const { start, end } = dayBounds(date);

    const [profile, schedule, tasks, habits, habitLogs, meals, mealLogs, sleep, mood, expenses, goalsRaw] =
      await this.prisma.$transaction([
        this.prisma.userProfile.findUnique({
          where: { userId },
          select: { currency: true },
        }),
        this.prisma.dailySchedule.findFirst({
          where: { userId, date: start },
          include: { items: { select: { status: true } } },
        }),
        this.prisma.task.findMany({
          where: { userId, dueDate: { gte: start, lt: end } },
          select: { status: true },
        }),
        this.prisma.habit.count({ where: { userId, isActive: true } }),
        this.prisma.habitLog.findMany({
          where: { userId, date: start },
          select: { completed: true },
        }),
        this.prisma.mealPlan.count({ where: { userId, date: start } }),
        this.prisma.mealLog.findMany({
          where: { userId, date: start },
          select: { estimatedCalories: true, cost: true },
        }),
        this.prisma.sleepLog.findFirst({
          where: { userId, date: start },
          select: { durationMinutes: true, quality: true },
        }),
        this.prisma.moodLog.findFirst({
          where: { userId, date: start },
          select: { mood: true, energyLevel: true, stressLevel: true },
        }),
        this.prisma.expense.findMany({
          where: { userId, expenseDate: { gte: start, lt: end } },
        }),
        this.prisma.personalGoal.findMany({
          where: { userId, status: 'ACTIVE' },
          take: 5,
        }),
      ]);

    const scheduleItems = schedule?.items ?? [];
    const scheduleSum = {
      present: !!schedule,
      total: scheduleItems.length,
      completed: scheduleItems.filter((i) => i.status === 'COMPLETED').length,
      pending: scheduleItems.filter((i) => i.status === 'PENDING').length,
      skipped: scheduleItems.filter((i) => i.status === 'SKIPPED').length,
      delayed: scheduleItems.filter((i) => i.status === 'DELAYED').length,
    };

    const tasksSum = {
      completed: tasks.filter((t) => t.status === 'COMPLETED').length,
      inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
      todo: tasks.filter((t) => t.status === 'TODO').length,
    };

    const caloriesSum = mealLogs.reduce(
      (sum, m) => (m.estimatedCalories ? sum + m.estimatedCalories : sum),
      0,
    );
    const costSum = mealLogs.reduce(
      (sum, m) => (m.cost ? sum + Number(m.cost) : sum),
      0,
    );

    const expensesTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const byNeedMap = new Map<string, number>();
    for (const e of expenses) {
      const key = e.needLevel ?? 'UNSPECIFIED';
      byNeedMap.set(key, (byNeedMap.get(key) ?? 0) + Number(e.amount));
    }

    const goals = goalsRaw.map((g) => ({
      title: g.title,
      progressPercent:
        g.targetValue && g.targetValue > 0 && g.currentValue !== null
          ? Math.round((g.currentValue / g.targetValue) * 100)
          : null,
    }));

    return {
      date,
      schedule: scheduleSum,
      tasks: tasksSum,
      habits: {
        active: habits,
        logged: habitLogs.length,
        completed: habitLogs.filter((l) => l.completed).length,
      },
      meals: {
        planCount: meals,
        logCount: mealLogs.length,
        estimatedCaloriesSum: mealLogs.length > 0 ? caloriesSum : null,
        cost: mealLogs.length > 0 ? costSum : null,
      },
      sleep: sleep ? { durationMinutes: sleep.durationMinutes, quality: sleep.quality } : null,
      mood: mood
        ? { mood: mood.mood, energyLevel: mood.energyLevel, stressLevel: mood.stressLevel }
        : null,
      expenses: {
        total: expensesTotal,
        count: expenses.length,
        byNeed: [...byNeedMap.entries()].map(([level, amount]) => ({ level, amount })),
      },
      goals: goals.length
        ? goals
        : [{ title: '(none active)', progressPercent: null }].filter(() => false),
      currency: profile?.currency ?? 'VND',
    };
  }

  private async persist(userId: string, date: string, review: DailyReviewOutput) {
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    return this.prisma.dailyReview.upsert({
      where: { userId_date: { userId, date: dayStart } },
      update: {
        summary: review.todaySummary,
        wins: review.wins,
        issues: review.issues,
        suggestions: review.suggestionsForTomorrow,
      },
      create: {
        userId,
        date: dayStart,
        summary: review.todaySummary,
        wins: review.wins,
        issues: review.issues,
        suggestions: review.suggestionsForTomorrow,
      },
    });
  }
}
