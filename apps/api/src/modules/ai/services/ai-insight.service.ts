import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LocaleService } from '../../../common/i18n/locale.service';
import { AiProviderService, briefAiError } from './ai-provider.service';
import { AiPromptTemplateService } from './ai-prompt-template.service';
import { AiJsonValidationService } from './ai-json-validation.service';
import { dateOnly } from '../../../common/utils/time.util';
import { WeeklyInsightSchema, type WeeklyInsight } from '../schemas/weekly-insight.schema';
import {
  buildWeeklyInsightPrompt,
  buildWeeklyInsightSystem,
  type WeeklyInsightContext,
} from '../prompts/weekly-insight.prompt';

export interface WeeklyInsightInput {
  weekStart: string; // YYYY-MM-DD (Mon)
}

type RequestLike = { headers?: Record<string, string | string[] | undefined>; locale?: string };

const FALLBACK_BY_LOCALE: Record<'vi' | 'en', WeeklyInsight> = {
  en: {
    summary: 'Could not synthesize insights this week — please try again later.',
    goodPoints: [],
    improvementPoints: [],
    nextWeekSuggestions: [],
  },
  vi: {
    summary: 'Chưa tổng hợp được insight tuần này — vui lòng thử lại sau.',
    goodPoints: [],
    improvementPoints: [],
    nextWeekSuggestions: [],
  },
};

@Injectable()
export class AiInsightService {
  private readonly logger = new Logger(AiInsightService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: AiProviderService,
    private readonly tpl: AiPromptTemplateService,
    private readonly json: AiJsonValidationService,
    private readonly locale: LocaleService,
  ) {}

  async weekly(userId: string, input: WeeklyInsightInput, req: RequestLike = {}) {
    const localeTag = await this.locale.forUser(userId, req);
    const start = dateOnly(input.weekStart);
    const end = new Date(start.getTime() + 7 * 86_400_000);
    const weekEnd = end.toISOString().slice(0, 10);

    const [tasks, habits, sleep, moods] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where: { userId, updatedAt: { gte: start, lt: end } },
        select: { status: true },
      }),
      this.prisma.habit.findMany({
        where: { userId, isActive: true },
        select: {
          id: true,
          name: true,
          targetCount: true,
          frequency: true,
          logs: {
            where: { date: { gte: start, lt: end }, completed: true },
            select: { id: true },
          },
        },
      }),
      this.prisma.sleepLog.findMany({
        where: { userId, date: { gte: start, lt: end } },
        select: { durationMinutes: true, quality: true },
      }),
      this.prisma.moodLog.findMany({
        where: { userId, date: { gte: start, lt: end } },
        select: { mood: true },
      }),
    ]);

    const taskStats = {
      completed: tasks.filter((t) => t.status === 'COMPLETED').length,
      carriedOver: tasks.filter((t) => t.status === 'TODO' || t.status === 'IN_PROGRESS').length,
      cancelled: tasks.filter((t) => t.status === 'CANCELLED').length,
    };
    const habitStats = habits.map((h) => ({
      name: h.name,
      targetPerWeek: h.frequency === 'DAILY' ? 7 : h.targetCount,
      logged: h.logs.length,
    }));
    const sleepAvg = sleep.length
      ? sleep.reduce((a, b) => a + b.durationMinutes, 0) / sleep.length
      : null;
    const goodNights = sleep.filter((s) => s.quality === 'GOOD' || s.quality === 'VERY_GOOD').length;
    const moodCount = new Map<string, number>();
    moods.forEach((m) => moodCount.set(m.mood, (moodCount.get(m.mood) ?? 0) + 1));
    const dominantMood =
      [...moodCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const ctx: WeeklyInsightContext = {
      weekStart: input.weekStart,
      weekEnd,
      taskStats,
      habitStats,
      sleepStats: { avgMinutes: sleepAvg, nights: sleep.length, goodNights },
      moodStats: { dominantMood, days: moods.length },
    };

    const system = buildWeeklyInsightSystem(localeTag);
    const prompt = buildWeeklyInsightPrompt(this.tpl, ctx);

    let insight: WeeklyInsight;
    let usedFallback = false;
    try {
      const completion = await this.provider.complete(
        { system, prompt, jsonMode: true, maxTokens: 1500, temperature: 0.5 },
      );
      insight = await this.json.parseAndValidate(completion.text, WeeklyInsightSchema, {
        task: 'weekly-insight',
        system,
      });
    } catch (e) {
      this.logger.warn(`weekly-insight fell back: ${briefAiError(e)}`);
      insight = FALLBACK_BY_LOCALE[localeTag];
      usedFallback = true;
    }

    // Persist as WeeklyReview row for the week.
    const saved = await this.prisma.weeklyReview.upsert({
      where: { userId_weekStart: { userId, weekStart: start } },
      update: {
        summary: insight.summary,
        habitInsight: habitStats.map((h) => `${h.name}: ${h.logged}/${h.targetPerWeek}`).join('; '),
        healthInsight: sleepAvg
          ? `Avg sleep ${Math.round(sleepAvg / 60)}h across ${sleep.length} nights.`
          : null,
        suggestions: insight.nextWeekSuggestions,
      },
      create: {
        userId,
        weekStart: start,
        summary: insight.summary,
        habitInsight: habitStats.map((h) => `${h.name}: ${h.logged}/${h.targetPerWeek}`).join('; '),
        healthInsight: sleepAvg
          ? `Avg sleep ${Math.round(sleepAvg / 60)}h across ${sleep.length} nights.`
          : null,
        suggestions: insight.nextWeekSuggestions,
      },
    });

    return { insight, stats: ctx, saved, locale: localeTag, usedFallback };
  }
}
