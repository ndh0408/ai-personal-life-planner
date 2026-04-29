/**
 * LifeSnapshotService (kept under the legacy name `UserContextService` so
 * existing callers continue to compile). Round 20.
 *
 * One service, one snapshot, every AI feature reads it. Goals:
 *
 * 1. **Privacy first.** PrivacySetting flags are the source of truth — a
 *    domain the user disabled never even gets queried, let alone sent to a
 *    model. The snapshot contract surfaces the flags so the LLM prompt can
 *    say "finance is hidden" instead of inventing numbers.
 * 2. **Cached.** Snapshot reads are dominated by short bursts (one assistant
 *    turn often hits the API 3-4 times). A 60 s Redis TTL turns those into
 *    a single Postgres trip; mutations call `invalidate()` to keep the data
 *    coherent.
 * 3. **Versioned.** Every snapshot carries `snapshotVersion` + `generatedAt`
 *    so debugging can correlate a model output to the exact context it saw.
 *
 * Caveat on caching: ioredis may not be ready yet at startup (lazy connect).
 * We swallow Redis errors silently and fall back to "always recompute" so
 * the API stays available if Redis is down. The snapshot is regenerated on
 * the next request — at worst we waste a few hundred ms.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { BehaviorService, type BehaviorSummary } from './behavior.service';
import { EventLogService } from './event-log.service';
import { AssistantMemoryService } from './assistant-memory.service';

export const SNAPSHOT_VERSION = '2026-04-29.r20.v1';
const CACHE_TTL_SECONDS = 60;

const EMPTY_BEHAVIOR: BehaviorSummary = {
  wakeHistogram: new Array(24).fill(0),
  sleepHistogram: new Array(24).fill(0),
  avgSleepByWeekday: new Array(7).fill(0),
  peakFocus: null,
  topExpenseCategories: [],
  recentMealTitles: [],
  moodSleepCorrelation: null,
  taskCompletionByPrio: { LOW: 0, MEDIUM: 0, HIGH: 0 },
};

export interface SnapshotPrivacy {
  personalizationEnabled: boolean;
  useFinanceForAI: boolean;
  useHealthForAI: boolean;
  useMealsForAI: boolean;
  useTasksForAI: boolean;
  aiMemoryEnabled: boolean;
}

export interface UserContext {
  snapshotVersion: string;
  generatedAt: string; // ISO
  now: string; // ISO
  tz: string;
  privacy: SnapshotPrivacy;
  profile: {
    preferredName: string | null;
    locale: 'vi' | 'en';
    mainGoals: string[];
    usualWakeTime: string | null;
    usualSleepTime: string | null;
    dislikes: string[];
    allergies: string[];
    monthlyGoal: string | null;
    workPattern: string | null;
    budgetMonthly: number | null;
  } | null;
  behavior: BehaviorSummary;
  /** Last 30 events newest-first, filtered to domains the user opted in to. */
  recentEvents: Array<{
    kind: string;
    summary: string;
    payload: Record<string, unknown>;
    createdAt: string;
  }>;
  /** Long-term Assistant memories (top weight first), max 10. Empty if aiMemoryEnabled=false. */
  memories: Array<{ fact: string; kind: string; weight: number }>;
  /** Top 5 active wallets newest-first. Empty if useFinanceForAI=false. */
  wallets: Array<{ id: string; name: string; balance: number; isDefault: boolean; currency: string }>;
  /** Recent capture corrections — populated once R21 ships CaptureCorrection. */
  recentCorrections: Array<{
    rawText: string;
    originalKind: string | null;
    correctedKind: string | null;
    createdAt: string;
  }>;

  // Live signals (null when the corresponding domain is hidden).
  lastSleepMinutes: number | null;
  lastMood: string | null;
  todaySpendVnd: number | null;
  monthSpendVnd: number | null;
  openHighPriorityTaskCount: number | null;
}

const DEFAULT_PRIVACY: SnapshotPrivacy = {
  personalizationEnabled: true,
  useFinanceForAI: true,
  useHealthForAI: true,
  useMealsForAI: true,
  useTasksForAI: true,
  aiMemoryEnabled: true,
};

const FINANCE_EVENT_KINDS = new Set(['EXPENSE_CREATED', 'INCOME_CREATED', 'WALLET_UPDATED']);
const HEALTH_EVENT_KINDS = new Set(['SLEEP_LOGGED', 'MOOD_LOGGED']);
const MEAL_EVENT_KINDS = new Set(['MEAL_LOGGED']);
const TASK_EVENT_KINDS = new Set(['TASK_CREATED', 'TASK_COMPLETED', 'PLAN_UPDATED']);

@Injectable()
export class UserContextService {
  private readonly logger = new Logger(UserContextService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly behavior: BehaviorService,
    private readonly events: EventLogService,
    private readonly memory: AssistantMemoryService,
  ) {}

  /** Public entry point. Hits the cache; recomputes on miss. */
  async build(userId: string): Promise<UserContext> {
    const cached = await this.tryReadCache(userId);
    if (cached) return cached;
    const fresh = await this.compute(userId);
    await this.tryWriteCache(userId, fresh);
    return fresh;
  }

  /** Drop the cache entry — call after any mutation that touches a domain
   *  the snapshot exposes. Safe to call when Redis is down. */
  async invalidate(userId: string): Promise<void> {
    try {
      await this.redis.client.del(this.cacheKey(userId));
    } catch (e) {
      this.logger.debug(`snapshot invalidate failed (will TTL out): ${(e as Error).message}`);
    }
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private cacheKey(userId: string): string {
    return `lifeos:snapshot:${userId}`;
  }

  private async tryReadCache(userId: string): Promise<UserContext | null> {
    try {
      const raw = await this.redis.client.get(this.cacheKey(userId));
      if (!raw) return null;
      return JSON.parse(raw) as UserContext;
    } catch {
      return null;
    }
  }

  private async tryWriteCache(userId: string, snapshot: UserContext): Promise<void> {
    try {
      await this.redis.client.set(
        this.cacheKey(userId),
        JSON.stringify(snapshot),
        'EX',
        CACHE_TTL_SECONDS,
      );
    } catch {
      /* fail open — cache miss next time is fine */
    }
  }

  private async compute(userId: string): Promise<UserContext> {
    const now = new Date();
    const generatedAt = now.toISOString();

    // Privacy first: read flags before any feature data so we can short-circuit
    // expensive queries on disabled domains.
    const privacyRow = await this.prisma.privacySetting.findUnique({ where: { userId } });
    const privacy: SnapshotPrivacy = privacyRow
      ? {
          personalizationEnabled: privacyRow.personalizationEnabled,
          useFinanceForAI: privacyRow.useFinanceForAI,
          useHealthForAI: privacyRow.useHealthForAI,
          useMealsForAI: privacyRow.useMealsForAI,
          useTasksForAI: privacyRow.useTasksForAI,
          aiMemoryEnabled: privacyRow.aiMemoryEnabled,
        }
      : DEFAULT_PRIVACY;

    const profileRow = await this.prisma.userProfile.findUnique({ where: { userId } });

    // If personalization is fully disabled, return a minimal snapshot — just
    // profile basics so the assistant can still address the user by name.
    if (!privacy.personalizationEnabled) {
      return {
        snapshotVersion: SNAPSHOT_VERSION,
        generatedAt,
        now: generatedAt,
        tz: profileRow?.timezone ?? 'Asia/Ho_Chi_Minh',
        privacy,
        profile: profileRow
          ? {
              preferredName: profileRow.preferredName,
              locale: (profileRow.locale as 'vi' | 'en') ?? 'vi',
              mainGoals: [],
              usualWakeTime: null,
              usualSleepTime: null,
              dislikes: [],
              allergies: [],
              monthlyGoal: null,
              workPattern: null,
              budgetMonthly: null,
            }
          : null,
        behavior: EMPTY_BEHAVIOR,
        recentEvents: [],
        memories: [],
        wallets: [],
        recentCorrections: [],
        lastSleepMinutes: null,
        lastMood: null,
        todaySpendVnd: null,
        monthSpendVnd: null,
        openHighPriorityTaskCount: null,
      };
    }

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60_000);

    // Fan out only into domains the user has enabled. Disabled domains return
    // null/empty without ever issuing a query.
    const [behaviorRaw, recentEvents, memoriesRaw, lastSleep, lastMood, todayExp, monthExp, openHighTasks, walletsRaw, correctionsRaw] =
      await Promise.all([
        this.behavior.get(userId),
        this.events.recent(userId, 30),
        privacy.aiMemoryEnabled ? this.memory.top(userId, 10) : Promise.resolve([]),
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
              where: { userId, deletedAt: null, expenseDate: { gte: todayStart, lt: todayEnd } },
              select: { amount: true },
            })
          : Promise.resolve([]),
        privacy.useFinanceForAI
          ? this.prisma.expense.findMany({
              where: { userId, deletedAt: null, expenseDate: { gte: monthStart } },
              select: { amount: true },
            })
          : Promise.resolve([]),
        privacy.useTasksForAI
          ? this.prisma.task.count({
              where: {
                userId,
                deletedAt: null,
                status: { in: ['TODO', 'IN_PROGRESS'] },
                priority: 'HIGH',
              },
            })
          : Promise.resolve(0),
        privacy.useFinanceForAI
          ? this.prisma.wallet.findMany({
              where: { userId, deletedAt: null },
              orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
              take: 5,
              select: { id: true, name: true, balance: true, isDefault: true, currency: true },
            })
          : Promise.resolve([]),
        // Round 30: surface the user's last 5 capture corrections in the
        // snapshot so the assistant can spot patterns ("your trà sữa
        // entries always end up as EXPENSE not MEAL — got it"). The
        // capture parser also uses the same data via CorrectionsService;
        // this is the snapshot consumer.
        this.prisma.captureCorrection.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            rawText: true,
            originalKind: true,
            correctedKind: true,
            createdAt: true,
          },
        }),
      ]);

    const behavior = this.gateBehavior(behaviorRaw, privacy);

    return {
      snapshotVersion: SNAPSHOT_VERSION,
      generatedAt,
      now: generatedAt,
      tz: profileRow?.timezone ?? 'Asia/Ho_Chi_Minh',
      privacy,
      profile: profileRow
        ? {
            preferredName: profileRow.preferredName,
            locale: (profileRow.locale as 'vi' | 'en') ?? 'vi',
            mainGoals: Array.isArray(profileRow.mainGoals) ? (profileRow.mainGoals as string[]) : [],
            usualWakeTime: profileRow.usualWakeTime,
            usualSleepTime: profileRow.usualSleepTime,
            dislikes: Array.isArray(profileRow.dislikes) ? (profileRow.dislikes as string[]) : [],
            allergies: Array.isArray(profileRow.allergies) ? (profileRow.allergies as string[]) : [],
            monthlyGoal: profileRow.monthlyGoal,
            workPattern: profileRow.workPattern,
            budgetMonthly: profileRow.budgetMonthly == null ? null : Number(profileRow.budgetMonthly),
          }
        : null,
      behavior,
      recentEvents: recentEvents
        .filter((e) => this.eventAllowed(e.kind, privacy))
        .map((e) => ({
          kind: e.kind,
          summary: e.summary,
          payload: (e.payload as Record<string, unknown>) ?? {},
          createdAt: e.createdAt.toISOString(),
        })),
      memories: memoriesRaw.map((m) => ({
        fact: m.fact,
        kind: m.kind,
        weight: m.weight,
      })),
      wallets: walletsRaw.map((w) => ({
        id: w.id,
        name: w.name,
        balance: Number(w.balance),
        isDefault: w.isDefault,
        currency: w.currency,
      })),
      recentCorrections: correctionsRaw.map((c) => ({
        rawText: c.rawText,
        originalKind: c.originalKind,
        correctedKind: c.correctedKind,
        createdAt: c.createdAt.toISOString(),
      })),
      lastSleepMinutes: privacy.useHealthForAI ? lastSleep?.durationMinutes ?? null : null,
      lastMood: privacy.useHealthForAI ? lastMood?.mood ?? null : null,
      todaySpendVnd: privacy.useFinanceForAI
        ? todayExp.reduce((s, e) => s + Number(e.amount), 0)
        : null,
      monthSpendVnd: privacy.useFinanceForAI
        ? monthExp.reduce((s, e) => s + Number(e.amount), 0)
        : null,
      openHighPriorityTaskCount: privacy.useTasksForAI ? openHighTasks : null,
    };
  }

  private gateBehavior(b: BehaviorSummary, privacy: SnapshotPrivacy): BehaviorSummary {
    // BehaviorSummary mixes domains; gate per-field rather than discarding the
    // whole object so partial opt-ins still get useful behaviour data.
    return {
      wakeHistogram: privacy.useHealthForAI ? b.wakeHistogram : EMPTY_BEHAVIOR.wakeHistogram,
      sleepHistogram: privacy.useHealthForAI ? b.sleepHistogram : EMPTY_BEHAVIOR.sleepHistogram,
      avgSleepByWeekday: privacy.useHealthForAI ? b.avgSleepByWeekday : EMPTY_BEHAVIOR.avgSleepByWeekday,
      peakFocus: privacy.useTasksForAI ? b.peakFocus : null,
      topExpenseCategories: privacy.useFinanceForAI ? b.topExpenseCategories : [],
      recentMealTitles: privacy.useMealsForAI ? b.recentMealTitles : [],
      moodSleepCorrelation: privacy.useHealthForAI ? b.moodSleepCorrelation : null,
      taskCompletionByPrio: privacy.useTasksForAI
        ? b.taskCompletionByPrio
        : EMPTY_BEHAVIOR.taskCompletionByPrio,
    };
  }

  private eventAllowed(kind: string, privacy: SnapshotPrivacy): boolean {
    if (FINANCE_EVENT_KINDS.has(kind)) return privacy.useFinanceForAI;
    if (HEALTH_EVENT_KINDS.has(kind)) return privacy.useHealthForAI;
    if (MEAL_EVENT_KINDS.has(kind)) return privacy.useMealsForAI;
    if (TASK_EVENT_KINDS.has(kind)) return privacy.useTasksForAI;
    return true; // capture/plan/insight events are always allowed
  }
}
