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
import type { Task, UserProfile } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { rangeFor } from '../../common/datetime/range';
import { UserContextService } from '../intelligence/user-context.service';
import { LlmService } from '../../common/llm/llm.service';
import { LlmError } from '../../common/llm/llm.types';
import type { DraftItem } from './planner.generator';

const SYS_PROMPT = `You are LifeOS AI's personal day planner. You are NOT a generic
template — every plan must reflect THIS specific user on THIS specific day.

Return STRICT JSON: { "summary": string, "items": [...] }

═══════════════════════════════════════════════════════════════════
HARD ANCHORS (violate these and the plan is wrong):
═══════════════════════════════════════════════════════════════════
1. WAKE TIME: If profile.usualWakeTime is set (HH:mm), breakfast MUST start
   between wake+30min and wake+90min. Example: wake 06:30 → breakfast 07:00–08:00.
   NEVER schedule breakfast more than 2 hours after wake — that's "late
   breakfast" not breakfast.
2. SLEEP TIME: If profile.usualSleepTime is set, dinner ends ≥ 2.5h before sleep.
   Wind-down REST item starts ~1h before sleep.
3. LUNCH: 4–5h after breakfast (so wake 06:30 + breakfast 07:30 → lunch ~12:00).
4. DINNER: 5–7h after lunch.
5. The user's "now" timestamp is the moment the plan is generated. If
   profile.usualWakeTime is in the past today (already woke up), plan from now
   forward — don't schedule a 07:00 breakfast at 11:00 in the morning.

═══════════════════════════════════════════════════════════════════
PERSONALIZATION (high signal):
═══════════════════════════════════════════════════════════════════
- Read mainGoals + recentMeals + lastMood + sleepTrendHours + topExpenseCategory.
- MEALS: rotate from recentMeals. Never suggest the same dish twice in 3 days.
  Suggestions must be a SPECIFIC dish + side ("cơm gà Hải Nam + canh chua"),
  NOT "ăn món Việt".
- ACTIVITIES: react to mood + sleep trend. Sleep < 6h average → softer day,
  shorter blocks (45min not 90min), an extra REST item. Mood STRESSED/SAD →
  add a HEALTH item (walk, breath work, call a friend).
- FINANCE item: only include if topExpenseCategory.pct > 35. Address THAT
  category specifically ("Hôm nay tự nấu thay vì gọi đồ ăn ngoài, tiết kiệm
  ~80k").
- TASKS: slot openTasks into 45–60min blocks during peak hours
  (wake+3h to wake+8h). HIGH priority first.

═══════════════════════════════════════════════════════════════════
TITLE QUALITY:
═══════════════════════════════════════════════════════════════════
GOOD                                          BAD
"Bữa sáng: bánh mì ốp la + cà phê đen"        "Bữa sáng"
"Đi bộ 15 phút quanh khu"                     "Tập thể dục"
"Gọi báo cáo dự án X (chuẩn bị 30p trước)"    "Họp"
"Wind-down: tắt màn hình, đọc 10 trang"       "Thư giãn"

═══════════════════════════════════════════════════════════════════
ANTI-PATTERNS (do not do):
═══════════════════════════════════════════════════════════════════
- Generic "Bữa sáng / trưa / tối" titles → always add the actual dish.
- "Xem phim" or "Thư giãn 1 giờ" with no detail → say what to watch / read.
- Same time grid every day (10:00 breakfast / 12:30 lunch / 19:00 dinner) →
  let wake/sleep window dictate.
- Skipping the user's open TODO tasks even if they have HIGH priority → slot them.

ITEM SHAPE:
- Each item: { "title": string, "type": one of [TASK, MEAL, REST, WORK, PERSONAL, HEALTH, FINANCE, CUSTOM],
  "startAt": ISO 8601 in user TZ, "endAt": ISO 8601 in user TZ }
- 6–10 items, ordered by startAt.

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
    private readonly userCtx: UserContextService,
    private readonly llm: LlmService,
  ) {}

  /**
   * Returns null if the user has no key, privacy is off, or the call fails.
   * Caller must fall back to the rule-based generator.
   */
  async generate(userId: string): Promise<{ items: DraftItem[]; summary: string | null } | null> {
    const privacy = await this.prisma.privacySetting.findUnique({ where: { userId } });
    if (!privacy?.personalizationEnabled) return null;

    const snap = await this.snapshot(userId, privacy);
    // Round 18: enrich the legacy snapshot with the unified UserContext.
    // Behaviour summary + recent events + memories give the AI a much wider
    // signal than the original 7-field snapshot.
    const ctx = await this.userCtx.build(userId);
    const userMsg = JSON.stringify({
      now: snap.now.toISOString(),
      tz: snap.tz,
      profile: ctx.profile,
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
      todaySpendVnd: ctx.todaySpendVnd,
      monthSpendVnd: ctx.monthSpendVnd,
      weekSpendVnd: snap.weekSpendVnd,
      topExpenseCategory: snap.topExpenseCategory,
      topExpenseCategories: ctx.behavior.topExpenseCategories,
      completedTaskCount7d: snap.completedTaskCount7d,
      // Behaviour patterns the AI can lean on.
      behaviorSummary: {
        avgSleepByWeekday: ctx.behavior.avgSleepByWeekday,
        moodSleepCorrelation: ctx.behavior.moodSleepCorrelation,
        peakFocus: ctx.behavior.peakFocus,
        taskCompletionByPrio: ctx.behavior.taskCompletionByPrio,
      },
      // Last 12 user actions — the AI sees what just happened.
      recentEvents: ctx.recentEvents.slice(0, 12).map((e) => ({
        kind: e.kind,
        summary: e.summary,
      })),
      // Long-term memories the user has shared in chat.
      memories: ctx.memories.slice(0, 6).map((m) => m.fact),
    });

    let parsed: { items?: LlmItem[]; summary?: string };
    try {
      // Planner schema is large + free-form; we lean on instructions rather
      // than strict JSON schema (the user-visible failure mode of a slightly
      // weird item is acceptable; a missed plan is not). Caller still
      // validates each item via mapToDrafts.
      const text = await this.llm.responsesText({
        userId,
        feature: 'planner',
        tier: 'smart',
        instructions: SYS_PROMPT + '\n\nReturn STRICT JSON only — no prose around the object.',
        input: userMsg,
        temperature: 0.45,
        maxOutputTokens: 1400,
        timeoutMs: TIMEOUT_MS,
      });
      parsed = JSON.parse(text) as { items?: LlmItem[]; summary?: string };
    } catch (e) {
      if (e instanceof LlmError) {
        this.logger.debug(`planner ${e.code}`);
      } else {
        this.logger.warn(`AI plan generation failed for userId=${userId}: ${(e as Error).message}`);
      }
      return null;
    }

    if (!Array.isArray(parsed.items) || parsed.items.length === 0) return null;
    let items = mapToDrafts(parsed.items);
    // Safety net: if the AI scheduled breakfast > 2h after the user's
    // declared wake time, slide the whole meal grid earlier proportionally.
    items = enforceWakeAnchor(items, snap.profile?.usualWakeTime ?? null, snap.tz);
    const summary =
      typeof parsed.summary === 'string' && parsed.summary.trim().length > 0
        ? parsed.summary.trim().slice(0, 240)
        : null;
    return { items, summary };
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

/**
 * Hard guarantee that the FIRST meal item in the plan starts within 2h of the
 * user's wake time. The LLM tends to anchor breakfast at 10:00 even for early
 * risers — we slide every item by the same delta when that drift is large.
 */
function enforceWakeAnchor(
  items: DraftItem[],
  usualWakeTime: string | null,
  tz: string,
): DraftItem[] {
  if (!usualWakeTime) return items;
  const m = /^(\d{1,2}):(\d{2})$/.exec(usualWakeTime.trim());
  if (!m) return items;
  const wakeH = Math.min(23, Math.max(0, Number(m[1])));
  const wakeMin = Math.min(59, Math.max(0, Number(m[2])));

  const firstMeal = items.find((it) => it.type === 'MEAL' && it.startAt);
  if (!firstMeal || !firstMeal.startAt) return items;

  // Convert that meal's UTC time → user-local hour/minute, ignoring date.
  const offsetMs = (tz === 'Asia/Ho_Chi_Minh' ? 7 * 60 : 0) * 60_000;
  const local = new Date(firstMeal.startAt.getTime() + offsetMs);
  const mealH = local.getUTCHours();
  const mealMin = local.getUTCMinutes();

  // Acceptable: breakfast in [wake+0:30, wake+2:00].
  const wakeAbs = wakeH * 60 + wakeMin;
  const mealAbs = mealH * 60 + mealMin;
  const driftMin = mealAbs - wakeAbs;
  if (driftMin >= 30 && driftMin <= 120) return items;

  // Drift too high (or breakfast before wake) — slide every item so the
  // first meal lands at wake+1h.
  const targetAbs = wakeAbs + 60;
  const shiftMs = (targetAbs - mealAbs) * 60_000;
  return items.map((it) => ({
    ...it,
    startAt: it.startAt ? new Date(it.startAt.getTime() + shiftMs) : null,
    endAt: it.endAt ? new Date(it.endAt.getTime() + shiftMs) : null,
  }));
}
