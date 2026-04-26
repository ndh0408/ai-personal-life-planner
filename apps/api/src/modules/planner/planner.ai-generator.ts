/**
 * AI-augmented day planner. Pulls a wide snapshot of the user's actual recent
 * behaviour — sleep variability, mood trend, meal history, expense categories,
 * task throughput — and asks OpenAI to draft a day that is *specific to this
 * person* on *this day*. No fixed meal slots, no template suggestions.
 *
 * Falls back to null on any failure so the rule-based generator can take over.
 * The user's encrypted OpenAI key is decrypted only for the duration of the
 * outbound call. Privacy toggles gate which signal classes are sent.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { Task, UserProfile } from '@prisma/client';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import { rangeFor } from '../../common/datetime/range';
import type { DraftItem } from './planner.generator';

const SYS_PROMPT = `You are LifeOS AI's personal day planner. You are NOT a generic
template — every plan must reflect THIS specific user on THIS specific day.

Return STRICT JSON: { "summary": string, "items": [...] }

PERSONALIZATION RULES (most important):
- Read the user's signals carefully. Their preferredName, mainGoals, usualWakeTime
  and usualSleepTime are individual — anchor meals + rest around THEIR window,
  not a default 7am/12pm/7pm template. If they wake at 9:30 and sleep at 1am,
  breakfast is around 10am, dinner around 8–9pm.
- For meals: look at recentMeals to see what they actually eat. Suggest specific
  food ideas that ROTATE from what they had recently (no two phở days in a row,
  add variety, balance protein/veg). If recentMeals is empty, suggest something
  light and grounded in Vietnamese cuisine for VN users.
- For activities: look at lastMood, sleepTrend, completedTaskCount. A user who
  slept 4h with STRESSED mood needs a softer day (shorter blocks, real rest).
  A user with high energy + GOOD sleep can take a heavier task load.
- For finance: if topExpenseCategory dominates the week (e.g. eating out > 60%),
  the FINANCE item should gently address THAT category, not a generic "review
  spending" line.
- For mainGoals: if they care about "sleep_better", emphasize the wind-down. If
  "save_money", default to home-cooked meals. If "work", protect deep-work blocks.

ITEM SHAPE:
- Each item: { "title": string, "type": one of [TASK, MEAL, REST, WORK, PERSONAL, HEALTH, FINANCE, CUSTOM],
  "startAt": ISO 8601 in user TZ, "endAt": ISO 8601 in user TZ }
- 6–10 items, ordered by startAt.
- Titles must be CONCRETE: "Bữa trưa: cơm gà nướng + canh chua" beats "Bữa trưa".
  "Đi bộ 15 phút quanh khu" beats "Tập thể dục".
- Slot the user's open tasks (HIGH priority first) into focused 45–60 min blocks.

SUMMARY:
- ONE short empathetic sentence (≤ 140 chars), second-person, addressed to the
  user by preferredName when known. Call out THE most relevant signal you
  noticed (low sleep last night, stressed mood, heavy spend, big task today).
- Vietnamese for VN locale users; otherwise English.
- No emoji, no bullet list, no rote phrasing like "Hôm nay là một ngày…".

OUTPUT: JSON only, no commentary.`;

const TIMEOUT_MS = 30_000;

interface RecentMeal {
  mealType: string;
  title: string;
  daysAgo: number;
}

interface SnapshotInput {
  now: Date;
  tz: string;
  profile: UserProfile | null;
  openTasks: Task[];
  lastSleepMinutes: number | null;
  sleepTrendHours: number[]; // last 7 nights, oldest first
  recentMoods: { mood: string; daysAgo: number }[];
  recentMeals: RecentMeal[];
  todaySpendVnd: number;
  weekSpendVnd: number;
  topExpenseCategory: { category: string; pct: number } | null;
  completedTaskCount7d: number;
}

interface LlmItem {
  title?: string;
  type?: string;
  startAt?: string;
  endAt?: string;
}

@Injectable()
export class PlannerAiGenerator {
  private readonly logger = new Logger(PlannerAiGenerator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly enc: EncryptionService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Returns null if the user has no key, privacy is off, or the call fails.
   * Caller must fall back to the rule-based generator.
   */
  async generate(userId: string): Promise<{ items: DraftItem[]; summary: string | null } | null> {
    const privacy = await this.prisma.privacySetting.findUnique({ where: { userId } });
    if (!privacy?.personalizationEnabled) return null;

    const keyRow = await this.prisma.userAiKey.findUnique({ where: { userId } });
    if (!keyRow || !keyRow.isActive) return null;

    let plain: string;
    try {
      plain = this.enc.open(keyRow.encryptedApiKey);
    } catch {
      return null;
    }

    const snap = await this.snapshot(userId, privacy);
    const userMsg = JSON.stringify({
      now: snap.now.toISOString(),
      tz: snap.tz,
      profile: snap.profile
        ? {
            preferredName: snap.profile.preferredName,
            usualWakeTime: snap.profile.usualWakeTime,
            usualSleepTime: snap.profile.usualSleepTime,
            locale: snap.profile.locale,
            mainGoals: snap.profile.mainGoals,
          }
        : null,
      openTasks: snap.openTasks.map((t) => ({
        title: t.title,
        priority: t.priority,
        dueAt: t.dueAt?.toISOString() ?? null,
        status: t.status,
      })),
      lastSleepHours:
        snap.lastSleepMinutes != null ? +(snap.lastSleepMinutes / 60).toFixed(1) : null,
      sleepTrendHours: snap.sleepTrendHours,
      recentMoods: snap.recentMoods,
      recentMeals: snap.recentMeals,
      todaySpendVnd: snap.todaySpendVnd,
      weekSpendVnd: snap.weekSpendVnd,
      topExpenseCategory: snap.topExpenseCategory,
      completedTaskCount7d: snap.completedTaskCount7d,
    });

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const client = new OpenAI({ apiKey: plain, baseURL: keyRow.baseUrl });
      const model =
        keyRow.defaultModel ??
        this.config.get<string>('OPENAI_DEFAULT_MODEL') ??
        'gpt-4o-mini';
      const res = await client.chat.completions.create(
        {
          model,
          messages: [
            { role: 'system', content: SYS_PROMPT },
            { role: 'user', content: userMsg },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7,
          max_tokens: 1400,
        },
        { signal: ctrl.signal },
      );
      const raw = res.choices[0]?.message?.content;
      if (!raw) return null;

      const parsed = JSON.parse(raw) as { items?: LlmItem[]; summary?: string };
      if (!Array.isArray(parsed.items) || parsed.items.length === 0) return null;
      const items = mapToDrafts(parsed.items);
      const summary =
        typeof parsed.summary === 'string' && parsed.summary.trim().length > 0
          ? parsed.summary.trim().slice(0, 240)
          : null;
      return { items, summary };
    } catch (e) {
      this.logger.warn(`AI plan generation failed for userId=${userId}: ${(e as Error).message}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private async snapshot(
    userId: string,
    privacy: { useFinanceForAI: boolean; useHealthForAI: boolean; useTasksForAI: boolean },
  ): Promise<SnapshotInput> {
    const tz = 'Asia/Ho_Chi_Minh';
    const now = new Date();
    const today = rangeFor('today', now, tz);
    const week = rangeFor('week', now, tz);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60_000);

    const [
      profile,
      openTasks,
      sleepLogs7,
      moodLogs7,
      mealLogs7,
      todayExp,
      weekExp,
      completedTasks7,
    ] = await Promise.all([
      this.prisma.userProfile.findUnique({ where: { userId } }),
      privacy.useTasksForAI
        ? this.prisma.task.findMany({
            where: {
              userId,
              deletedAt: null,
              status: { in: ['TODO', 'IN_PROGRESS'] },
              OR: [{ dueAt: null }, { dueAt: { lt: today.end } }],
            },
            orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }],
            take: 10,
          })
        : Promise.resolve([] as Task[]),
      privacy.useHealthForAI
        ? this.prisma.sleepLog.findMany({
            where: { userId, sleepAt: { gte: sevenDaysAgo } },
            orderBy: { sleepAt: 'asc' },
            select: { durationMinutes: true, sleepAt: true },
          })
        : Promise.resolve([]),
      privacy.useHealthForAI
        ? this.prisma.moodLog.findMany({
            where: { userId, loggedAt: { gte: sevenDaysAgo } },
            orderBy: { loggedAt: 'desc' },
            select: { mood: true, loggedAt: true },
            take: 5,
          })
        : Promise.resolve([]),
      this.prisma.mealLog.findMany({
        where: { userId, loggedAt: { gte: sevenDaysAgo } },
        orderBy: { loggedAt: 'desc' },
        select: { title: true, mealType: true, loggedAt: true },
        take: 12,
      }),
      privacy.useFinanceForAI
        ? this.prisma.expense.findMany({
            where: {
              userId,
              deletedAt: null,
              expenseDate: { gte: today.start, lt: today.end },
            },
            select: { amount: true },
          })
        : Promise.resolve([]),
      privacy.useFinanceForAI
        ? this.prisma.expense.findMany({
            where: {
              userId,
              deletedAt: null,
              expenseDate: { gte: week.start, lt: week.end },
            },
            select: { amount: true, category: true },
          })
        : Promise.resolve([]),
      privacy.useTasksForAI
        ? this.prisma.task.count({
            where: {
              userId,
              deletedAt: null,
              status: 'COMPLETED',
              updatedAt: { gte: sevenDaysAgo },
            },
          })
        : Promise.resolve(0),
    ]);

    const sleepTrendHours = sleepLogs7.map((s) => +(s.durationMinutes / 60).toFixed(1));
    const lastSleepMinutes = sleepLogs7.length > 0
      ? sleepLogs7[sleepLogs7.length - 1].durationMinutes
      : null;

    const recentMoods = moodLogs7.map((m) => ({
      mood: m.mood,
      daysAgo: Math.max(0, Math.floor((now.getTime() - m.loggedAt.getTime()) / (24 * 60 * 60_000))),
    }));

    const recentMeals: RecentMeal[] = mealLogs7.map((m) => ({
      mealType: m.mealType,
      title: m.title,
      daysAgo: Math.max(0, Math.floor((now.getTime() - m.loggedAt.getTime()) / (24 * 60 * 60_000))),
    }));

    const weekTotal = weekExp.reduce((s, e) => s + Number(e.amount), 0);
    const byCat: Record<string, number> = {};
    for (const e of weekExp) byCat[e.category] = (byCat[e.category] ?? 0) + Number(e.amount);
    let topExpenseCategory: { category: string; pct: number } | null = null;
    if (weekTotal > 0) {
      const [top] = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
      if (top) topExpenseCategory = { category: top[0], pct: Math.round((top[1] / weekTotal) * 100) };
    }

    return {
      now,
      tz,
      profile,
      openTasks,
      lastSleepMinutes,
      sleepTrendHours,
      recentMoods,
      recentMeals,
      todaySpendVnd: todayExp.reduce((s, e) => s + Number(e.amount), 0),
      weekSpendVnd: weekTotal,
      topExpenseCategory,
      completedTaskCount7d: completedTasks7,
    };
  }
}

const VALID_TYPES = new Set([
  'TASK',
  'MEAL',
  'REST',
  'WORK',
  'PERSONAL',
  'HEALTH',
  'FINANCE',
  'CUSTOM',
]);

function mapToDrafts(items: LlmItem[]): DraftItem[] {
  const drafts: DraftItem[] = [];
  for (const it of items) {
    if (!it?.title || !it.type || !VALID_TYPES.has(it.type)) continue;
    const startAt = it.startAt ? new Date(it.startAt) : null;
    const endAt = it.endAt ? new Date(it.endAt) : null;
    if (startAt && Number.isNaN(startAt.getTime())) continue;
    if (endAt && Number.isNaN(endAt.getTime())) continue;
    drafts.push({
      title: it.title.slice(0, 200),
      type: it.type as DraftItem['type'],
      startAt,
      endAt,
      sortOrder: drafts.length + 1,
    });
  }
  return drafts
    .sort((a, b) => {
      const at = a.startAt?.getTime() ?? Infinity;
      const bt = b.startAt?.getTime() ?? Infinity;
      return at - bt;
    })
    .map((d, i) => ({ ...d, sortOrder: i + 1 }));
}
