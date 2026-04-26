/**
 * AI-augmented day planner. Loads a snapshot of the user's recent context
 * (profile, today's open tasks, last night's sleep, latest mood, today's
 * expenses) and asks OpenAI to draft a day. Falls back to null on any
 * failure so the rule-based generator can take over.
 *
 * The user's encrypted OpenAI key is decrypted only for the duration of
 * the outbound call. Privacy toggles gate which signals are sent.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { Task, UserProfile } from '@prisma/client';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import { rangeFor } from '../../common/datetime/range';
import type { DraftItem } from './planner.generator';

const SYS_PROMPT = `You are LifeOS AI's day planner.
Given a snapshot of the user's recent activity, produce a JSON plan for TODAY.
The plan is a flat array of items. Be specific to what you see.

Constraints:
- Return STRICT JSON shape: { "items": [...] }
- Each item: { "title": string, "type": one of [TASK, MEAL, REST, WORK, PERSONAL, HEALTH, FINANCE, CUSTOM],
  "startAt": ISO 8601 string in user TZ, "endAt": ISO 8601 string }
- 6–10 items, ordered by startAt.
- Always include three meals (BREAKFAST/LUNCH/DINNER) anchored at sensible local times,
  customised to the user's usual wake/sleep window.
- Slot the user's open TODO/IN_PROGRESS tasks into 60-min blocks; HIGH priority first.
- If sleep < 6h last night, add an early wind-down item before usual sleep time.
- If mood was STRESSED/TIRED, add a HEALTH break (walk, stretch).
- If today's expenses are already high vs week-avg, add a FINANCE personal note.
- Title in Vietnamese for VN locale users; otherwise English.
- No commentary outside the JSON.`;

const TIMEOUT_MS = 30_000;

interface SnapshotInput {
  now: Date;
  tz: string;
  profile: UserProfile | null;
  openTasks: Task[];
  lastSleepMinutes: number | null;
  lastMood: string | null;
  todaySpendVnd: number;
  weekSpendVnd: number;
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
  async generate(userId: string): Promise<DraftItem[] | null> {
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
      lastMood: snap.lastMood,
      todaySpendVnd: snap.todaySpendVnd,
      weekSpendVnd: snap.weekSpendVnd,
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
          temperature: 0.4,
          max_tokens: 1200,
        },
        { signal: ctrl.signal },
      );
      const raw = res.choices[0]?.message?.content;
      if (!raw) return null;

      const parsed = JSON.parse(raw) as { items?: LlmItem[] };
      if (!Array.isArray(parsed.items) || parsed.items.length === 0) return null;
      return mapToDrafts(parsed.items);
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

    const [profile, openTasks, lastSleep, lastMood, todayExp, weekExp] = await Promise.all([
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
        ? this.prisma.sleepLog.findFirst({
            where: { userId },
            orderBy: { sleepAt: 'desc' },
            select: { durationMinutes: true },
          })
        : Promise.resolve(null),
      privacy.useHealthForAI
        ? this.prisma.moodLog.findFirst({
            where: { userId },
            orderBy: { loggedAt: 'desc' },
            select: { mood: true },
          })
        : Promise.resolve(null),
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
            select: { amount: true },
          })
        : Promise.resolve([]),
    ]);

    return {
      now,
      tz,
      profile,
      openTasks,
      lastSleepMinutes: lastSleep?.durationMinutes ?? null,
      lastMood: lastMood?.mood ?? null,
      todaySpendVnd: todayExp.reduce((s, e) => s + Number(e.amount), 0),
      weekSpendVnd: weekExp.reduce((s, e) => s + Number(e.amount), 0),
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
  // Sort by start time; items without a start go last.
  return drafts
    .sort((a, b) => {
      const at = a.startAt?.getTime() ?? Infinity;
      const bt = b.startAt?.getTime() ?? Infinity;
      return at - bt;
    })
    .map((d, i) => ({ ...d, sortOrder: i + 1 }));
}
