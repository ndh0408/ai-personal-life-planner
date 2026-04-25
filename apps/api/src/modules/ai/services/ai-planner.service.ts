import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LocaleService } from '../../../common/i18n/locale.service';
import { AiProviderService } from './ai-provider.service';
import { AiProviderResolverService } from './ai-provider-resolver.service';
import { PrivacyService } from '../../privacy/privacy.service';
import { AiPromptTemplateService } from './ai-prompt-template.service';
import { AiInvalidJsonError, AiJsonValidationService } from './ai-json-validation.service';
import { PreviewCacheService } from './preview-cache.service';
import { dateOnly, dateToHhmm, hhmmToDate, toDateOnly } from '../../../common/utils/time.util';
import { SchedulePlanSchema, type SchedulePlan } from '../schemas/schedule-plan.schema';
import { ReschedulePreviewSchema, type ReschedulePreview } from '../schemas/reschedule.schema';
import {
  buildGenerateSchedulePrompt,
  buildGenerateScheduleSystem,
  type GenerateScheduleContext,
} from '../prompts/generate-schedule.prompt';
import {
  buildReschedulePrompt,
  buildRescheduleSystem,
  type RescheduleContext,
} from '../prompts/reschedule.prompt';

export interface GenerateScheduleInput {
  date: string;
  energyLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  mood?: 'HAPPY' | 'NORMAL' | 'STRESSED' | 'TIRED' | 'SAD' | 'MOTIVATED';
  extraNote?: string;
}

export interface RescheduleInput {
  date: string;
  currentTime: string; // HH:mm
  delayMinutes: number;
  mustKeepItemIds?: string[];
  priorityNote?: string;
}

export interface ApplyRescheduleInput {
  date: string;
  previewId: string;
}

type RequestLike = { headers?: Record<string, string | string[] | undefined>; locale?: string };

const FALLBACK_PLAN: SchedulePlan = {
  wakeUpTime: '06:30',
  sleepTime: '23:00',
  summary:
    'Could not generate a personalized plan right now — using a safe default. Try again in a moment.',
  schedule: [
    { title: 'Wake up', description: '', startTime: '06:30', endTime: '06:45', type: 'REST', priority: 'LOW', reason: 'fallback' },
    { title: 'Breakfast', description: '', startTime: '07:00', endTime: '07:30', type: 'MEAL', priority: 'MEDIUM', reason: 'fallback' },
    { title: 'Focus block', description: '', startTime: '09:00', endTime: '11:00', type: 'WORK', priority: 'HIGH', reason: 'fallback' },
    { title: 'Lunch', description: '', startTime: '12:00', endTime: '13:00', type: 'MEAL', priority: 'MEDIUM', reason: 'fallback' },
    { title: 'Wind down', description: '', startTime: '22:00', endTime: '22:45', type: 'REST', priority: 'LOW', reason: 'fallback' },
  ],
  warnings: ['AI fallback used — schedule is generic.'],
  tips: [],
};

@Injectable()
export class AiPlannerService {
  private readonly logger = new Logger(AiPlannerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: AiProviderService,
    private readonly tpl: AiPromptTemplateService,
    private readonly json: AiJsonValidationService,
    private readonly previews: PreviewCacheService,
    private readonly locale: LocaleService,
    private readonly resolver: AiProviderResolverService,
    private readonly privacy: PrivacyService,
  ) {}

  // ---- 1) generate-schedule -------------------------------------------------

  async generate(userId: string, input: GenerateScheduleInput, req: RequestLike = {}) {
    const localeTag = await this.locale.forUser(userId, req);
    const gates = await this.privacy.aiGates(userId);
    if (!gates.schedule) {
      // Privacy: schedule data may not be sent to AI. Persist a safe
      // fallback plan instead of calling AI at all.
      const saved = await this.persistPlan(userId, input.date, FALLBACK_PLAN, false, input);
      return {
        plan: FALLBACK_PLAN,
        saved,
        usedFallback: true,
        disabledByPrivacy: true,
      };
    }
    const ctx = await this.collectGenerateContext(userId, input);
    const system = buildGenerateScheduleSystem(localeTag);
    const prompt = buildGenerateSchedulePrompt(this.tpl, ctx);

    let plan: SchedulePlan;
    let usedFallback = false;
    try {
      const completion = await this.resolver.completeForUser(
        userId,
        'planner',
        { system, prompt, jsonMode: true, maxTokens: 1800, temperature: 0.4 },
      );
      plan = await this.json.parseAndValidate(completion.text, SchedulePlanSchema, {
        task: 'generate-schedule',
        system,
      });
    } catch (e) {
      this.logger.warn(`generate-schedule fell back: ${this.briefError(e)}`);
      usedFallback = true;
      plan = FALLBACK_PLAN;
    }

    const saved = await this.persistPlan(userId, input.date, plan, !usedFallback, input);
    return { plan, saved, usedFallback };
  }

  // ---- 2) reschedule (preview only) -----------------------------------------

  async preview(userId: string, input: RescheduleInput, req: RequestLike = {}) {
    const localeTag = await this.locale.forUser(userId, req);
    const schedule = await this.prisma.dailySchedule.findUnique({
      where: { userId_date: { userId, date: dateOnly(input.date) } },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!schedule) throw new NotFoundException('No schedule found for that date');

    const ctx: RescheduleContext = {
      date: input.date,
      currentTime: input.currentTime,
      delayMinutes: input.delayMinutes,
      mustKeepItemIds: input.mustKeepItemIds,
      priorityNote: input.priorityNote,
      items: schedule.items.map((i) => ({
        id: i.id,
        title: i.title,
        type: i.type,
        priority: i.priority,
        startTime: dateToHhmm(i.startTime) ?? '00:00',
        endTime: dateToHhmm(i.endTime) ?? '00:00',
        status: i.status,
      })),
    };

    const system = buildRescheduleSystem(localeTag);
    const prompt = buildReschedulePrompt(this.tpl, ctx);

    let preview: ReschedulePreview;
    try {
      const completion = await this.resolver.completeForUser(
        userId,
        'planner',
        { system, prompt, jsonMode: true, maxTokens: 1200, temperature: 0.3 },
      );
      preview = await this.json.parseAndValidate(completion.text, ReschedulePreviewSchema, {
        task: 'reschedule',
        system,
      });
    } catch (e) {
      this.logger.warn(`reschedule fell back: ${this.briefError(e)}`);
      preview = {
        summary: 'Could not generate a re-plan; please adjust manually.',
        kept: [],
        shortened: [],
        removed: [],
        warnings: ['AI fallback used.'],
      };
    }

    // Sanity: every id referenced in preview must belong to this schedule.
    const validIds = new Set(schedule.items.map((i) => i.id));
    const filterValid = <T extends { id: string }>(arr: T[]) => arr.filter((x) => validIds.has(x.id));
    preview = {
      ...preview,
      kept: filterValid(preview.kept),
      shortened: filterValid(preview.shortened),
      removed: filterValid(preview.removed),
    };

    const previewId = this.previews.put(userId, {
      scheduleId: schedule.id,
      date: input.date,
      preview,
    });

    return { previewId, preview };
  }

  // ---- 3) apply-reschedule --------------------------------------------------

  async apply(userId: string, input: ApplyRescheduleInput) {
    const cached = this.previews.get<{
      scheduleId: string;
      date: string;
      preview: ReschedulePreview;
    }>(userId, input.previewId);
    if (!cached) throw new NotFoundException('Preview not found or expired');
    if (cached.date !== input.date) {
      throw new ForbiddenException('Preview date does not match');
    }

    const schedule = await this.prisma.dailySchedule.findUnique({
      where: { id: cached.scheduleId },
      include: { items: true },
    });
    if (!schedule || schedule.userId !== userId) {
      throw new ForbiddenException();
    }

    const removeIds = new Set(cached.preview.removed.map((r) => r.id));
    const shortenById = new Map(cached.preview.shortened.map((s) => [s.id, s.minutesRemoved]));

    await this.prisma.$transaction(async (tx) => {
      if (removeIds.size > 0) {
        await tx.scheduleItem.deleteMany({ where: { id: { in: [...removeIds] } } });
      }
      for (const item of schedule.items) {
        if (removeIds.has(item.id)) continue;
        const minutesRemoved = shortenById.get(item.id);
        if (minutesRemoved && minutesRemoved > 0) {
          const newEnd = new Date(item.endTime.getTime() - minutesRemoved * 60_000);
          if (newEnd > item.startTime) {
            await tx.scheduleItem.update({
              where: { id: item.id },
              data: { endTime: newEnd, reason: `shortened by ${minutesRemoved}m` },
            });
          }
        }
      }
    });

    this.previews.delete(input.previewId);

    return this.prisma.dailySchedule.findUnique({
      where: { id: cached.scheduleId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  // ---- helpers --------------------------------------------------------------

  private async collectGenerateContext(
    userId: string,
    input: GenerateScheduleInput,
  ): Promise<GenerateScheduleContext> {
    const [profile, tasks, habits, latestSleep, latestMood] = await this.prisma.$transaction([
      this.prisma.userProfile.findUnique({ where: { userId } }),
      this.prisma.task.findMany({
        where: { userId, status: { in: ['TODO', 'IN_PROGRESS'] } },
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
        take: 10,
      }),
      this.prisma.habit.findMany({ where: { userId, isActive: true } }),
      this.prisma.sleepLog.findFirst({ where: { userId }, orderBy: { date: 'desc' } }),
      this.prisma.moodLog.findFirst({ where: { userId }, orderBy: { date: 'desc' } }),
    ]);

    return {
      date: input.date,
      energyLevel: input.energyLevel,
      mood: input.mood,
      extraNote: input.extraNote,
      profile: profile
        ? {
            fullName: profile.fullName,
            age: profile.age,
            occupation: profile.occupation,
            workStartTime: dateToHhmm(profile.workStartTime),
            workEndTime: dateToHhmm(profile.workEndTime),
            usualWakeTime: dateToHhmm(profile.usualWakeTime),
            usualSleepTime: dateToHhmm(profile.usualSleepTime),
            mainGoal: profile.mainGoal,
            activityLevel: profile.activityLevel,
            // healthNotes intentionally omitted — privacy-by-default in prompts
            dietaryPreference: profile.dietaryPreference,
            timezone: profile.timezone,
          }
        : { timezone: 'Asia/Ho_Chi_Minh' },
      tasks: tasks.map((t) => ({
        title: t.title,
        priority: t.priority,
        estimatedMinutes: t.estimatedMinutes,
        dueAtIso: t.dueDate ? t.dueDate.toISOString() : null,
      })),
      habits: habits.map((h) => ({
        name: h.name,
        targetCount: h.targetCount,
        frequency: h.frequency,
      })),
      latestSleep: latestSleep
        ? {
            quality: latestSleep.quality,
            durationMinutes: latestSleep.durationMinutes,
            date: toDateOnly(latestSleep.date) ?? '',
          }
        : null,
      latestMood: latestMood
        ? {
            mood: latestMood.mood,
            energyLevel: latestMood.energyLevel,
            stressLevel: latestMood.stressLevel,
            date: toDateOnly(latestMood.date) ?? '',
          }
        : null,
    };
  }

  private async persistPlan(
    userId: string,
    dateStr: string,
    plan: SchedulePlan,
    aiGenerated: boolean,
    input: GenerateScheduleInput,
  ) {
    const date = dateOnly(dateStr);
    const baseDate = date; // start of day UTC, used to anchor HH:mm into DateTime

    const result = await this.prisma.$transaction(async (tx) => {
      const schedule = await tx.dailySchedule.upsert({
        where: { userId_date: { userId, date } },
        create: {
          userId,
          date,
          wakeUpTime: hhmmToDate(plan.wakeUpTime),
          sleepTime: hhmmToDate(plan.sleepTime),
          summary: plan.summary,
          energyLevel: input.energyLevel ?? null,
          mood: input.mood ?? null,
          aiGenerated,
          status: 'ACTIVE',
        },
        update: {
          wakeUpTime: hhmmToDate(plan.wakeUpTime),
          sleepTime: hhmmToDate(plan.sleepTime),
          summary: plan.summary,
          energyLevel: input.energyLevel ?? null,
          mood: input.mood ?? null,
          aiGenerated,
          status: 'ACTIVE',
        },
      });

      // Replace items atomically
      await tx.scheduleItem.deleteMany({ where: { scheduleId: schedule.id } });
      for (let i = 0; i < plan.schedule.length; i++) {
        const item = plan.schedule[i];
        await tx.scheduleItem.create({
          data: {
            scheduleId: schedule.id,
            userId,
            title: item.title,
            description: item.description || null,
            startTime: anchorTime(baseDate, item.startTime),
            endTime: anchorTime(baseDate, item.endTime),
            type: item.type,
            priority: item.priority,
            reason: item.reason || null,
            sortOrder: i,
            aiGenerated,
          },
        });
      }
      return tx.dailySchedule.findUnique({
        where: { id: schedule.id },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });
    });
    return result;
  }

  private briefError(e: unknown): string {
    if (e instanceof AiInvalidJsonError) return `invalid-json: ${e.message}`;
    if (e instanceof Error) return `${e.name}: ${e.message}`;
    return String(e);
  }
}

function anchorTime(baseDate: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(baseDate.getTime() + (h * 60 + m) * 60_000);
}
