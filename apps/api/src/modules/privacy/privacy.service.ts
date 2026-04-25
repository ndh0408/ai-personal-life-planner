import { Injectable } from '@nestjs/common';
import type {
  PrivacySetting,
  Prisma,
  SensitiveDataType,
  RecommendationEvidence,
  AiMemoryType,
  AiPersonalizationMemory,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { UpdatePrivacySettingsInput, RecordConsentInput } from '@planner/shared';

/**
 * Default privacy settings for a freshly-registered user.
 *
 * AI personalisation domains the user opted IN to at signup default ON
 * because they're the core product value. Device-permission gates default
 * OFF — the user must explicitly opt in before the OS prompt fires.
 * Anonymised diagnostics is opt-in (defaults to OFF).
 */
const DEFAULTS = {
  personalizationEnabled: true,
  useScheduleForAI: true,
  useTasksForAI: true,
  useHabitsForAI: true,
  useMealsForAI: true,
  useMealForAI: true, // legacy alias kept in DB
  useHealthForAI: true,
  useFinanceForAI: true,
  useGoalsForAI: true,
  useCalendarContext: false,
  useLocationContext: false,
  useHealthFitnessContext: false,
  voiceInputEnabled: false,
  proactiveRecommendations: true,
  anonymizedDiagnostics: false,
};

/**
 * Compact gate struct consumed by AI services. EVERY field is the AND of
 * `personalizationEnabled` with the matching domain toggle, so callers
 * never have to remember "did I check the master switch?".
 */
export type PrivacyGates = {
  personalization: boolean;
  schedule: boolean;
  tasks: boolean;
  habits: boolean;
  meals: boolean;
  /** @deprecated alias of `meals`. */
  meal: boolean;
  health: boolean;
  finance: boolean;
  goals: boolean;
  calendar: boolean;
  location: boolean;
  healthFitness: boolean;
};

@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Always returns a row. If the user has never touched their settings we
   * return the in-memory defaults without writing — only the first explicit
   * PUT materialises the row.
   */
  async getSettings(userId: string): Promise<PrivacySetting & { _ephemeral?: true }> {
    const found = await this.prisma.privacySetting.findUnique({ where: { userId } });
    if (found) return found;
    return {
      id: '',
      userId,
      ...DEFAULTS,
      createdAt: new Date(0),
      updatedAt: new Date(0),
      _ephemeral: true,
    } as PrivacySetting & { _ephemeral?: true };
  }

  async updateSettings(
    userId: string,
    input: UpdatePrivacySettingsInput,
  ): Promise<PrivacySetting> {
    // Unify `useVoiceInput` (new name) ⇆ `voiceInputEnabled` (DB column) and
    // `useMealForAI` (legacy) ⇆ `useMealsForAI` (canonical).
    const data: Record<string, boolean> = { ...input };
    if (input.useVoiceInput !== undefined) data.voiceInputEnabled = input.useVoiceInput;
    if (input.voiceInputEnabled !== undefined) data.voiceInputEnabled = input.voiceInputEnabled;
    delete data.useVoiceInput;
    if (input.useMealsForAI !== undefined) data.useMealForAI = input.useMealsForAI;
    if (input.useMealForAI !== undefined) data.useMealForAI = input.useMealForAI;
    return this.prisma.privacySetting.upsert({
      where: { userId },
      create: { userId, ...DEFAULTS, ...data },
      update: data,
    });
  }

  /** Append-only consent ledger. Revocation writes a new row + back-fills
   *  the prior grant's `revokedAt`. */
  async recordConsent(
    userId: string,
    input: RecordConsentInput,
  ): Promise<{ id: string }> {
    return this.prisma.$transaction(async (tx) => {
      if (!input.granted) {
        await tx.userConsent.updateMany({
          where: {
            userId,
            consentType: input.consentType,
            granted: true,
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });
      }
      const row = await tx.userConsent.create({
        data: {
          userId,
          consentType: input.consentType,
          granted: input.granted,
          version: input.version,
          metadata: (input.metadata ?? null) as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      return row;
    });
  }

  listConsents(userId: string, limit = 100) {
    return this.prisma.userConsent.findMany({
      where: { userId },
      orderBy: { grantedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  /**
   * Snapshot of what the AI currently sees + how much data the user owns +
   * when each sensitive domain was last accessed.
   */
  async dataUsageSummary(userId: string) {
    const settings = await this.getSettings(userId);
    const aiOn = settings.personalizationEnabled;

    const [
      schedules,
      tasks,
      expenses,
      incomes,
      sleepLogs,
      moodLogs,
      healthMetrics,
      aiMessages,
      recentConsents,
      lastAccessRows,
    ] = await Promise.all([
      this.prisma.dailySchedule.count({ where: { userId } }),
      this.prisma.task.count({ where: { userId } }),
      this.prisma.expense.count({ where: { userId } }),
      this.prisma.income.count({ where: { userId } }),
      this.prisma.sleepLog.count({ where: { userId } }),
      this.prisma.moodLog.count({ where: { userId } }),
      this.prisma.healthMetric.count({ where: { userId } }),
      this.prisma.aIMessage.count({ where: { userId } }),
      this.prisma.userConsent.findMany({
        where: { userId },
        orderBy: { grantedAt: 'desc' },
        take: 20,
      }),
      // Latest sensitive-access row per dataType. Postgres-friendly: group
      // and use Math.max via DISTINCT ON would be cleaner, but Prisma's
      // groupBy with `_max` works portably.
      this.prisma.sensitiveAccessLog.groupBy({
        by: ['dataType'],
        where: { userId },
        _max: { createdAt: true },
      }),
    ]);

    const lastAccess: Record<string, string> = {};
    for (const row of lastAccessRows) {
      if (row._max.createdAt) {
        lastAccess[row.dataType] = row._max.createdAt.toISOString();
      }
    }

    return {
      aiSeesSchedule: aiOn && settings.useScheduleForAI,
      aiSeesTasks: aiOn && settings.useTasksForAI,
      aiSeesHabits: aiOn && settings.useHabitsForAI,
      aiSeesMeals: aiOn && settings.useMealsForAI,
      aiSeesMeal: aiOn && settings.useMealsForAI, // legacy alias
      aiSeesHealth: aiOn && settings.useHealthForAI,
      aiSeesFinance: aiOn && settings.useFinanceForAI,
      aiSeesGoals: aiOn && settings.useGoalsForAI,
      storedCounts: {
        schedules,
        tasks,
        expenses,
        incomes,
        sleepLogs,
        moodLogs,
        healthMetrics,
        aiMessages,
      },
      lastAccess,
      recentConsents,
    };
  }

  /** AI services consume this to decide what to fetch + send. */
  async aiGates(userId: string): Promise<PrivacyGates> {
    const s = await this.getSettings(userId);
    const on = s.personalizationEnabled;
    return {
      personalization: on,
      schedule: on && s.useScheduleForAI,
      tasks: on && s.useTasksForAI,
      habits: on && s.useHabitsForAI,
      meals: on && s.useMealsForAI,
      meal: on && s.useMealsForAI, // alias
      health: on && s.useHealthForAI,
      finance: on && s.useFinanceForAI,
      goals: on && s.useGoalsForAI,
      calendar: on && s.useCalendarContext,
      location: on && s.useLocationContext,
      healthFitness: on && s.useHealthFitnessContext,
    };
  }

  /**
   * Audit pin every time an AI service accesses a sensitive data domain on
   * behalf of the user. Metadata-only — never the raw values themselves.
   * Failures are swallowed: an audit-write outage must not block AI.
   */
  async logAccess(
    userId: string,
    dataType: SensitiveDataType,
    purpose: string,
    accessedBy: string,
    sourceFeature: string,
  ): Promise<void> {
    try {
      await this.prisma.sensitiveAccessLog.create({
        data: { userId, dataType, purpose, accessedBy, sourceFeature },
      });
    } catch {
      // Best-effort: an audit-log outage should not break user-facing AI.
    }
  }

  /**
   * Persist explainable evidence for a recommendation. Each row carries a
   * short, locale-tagged human summary — never raw amounts / notes.
   */
  async addRecommendationEvidence(
    recommendationId: string,
    userId: string,
    items: Array<{
      dataType: SensitiveDataType;
      summary: string;
      locale: string;
      weight?: number;
    }>,
  ): Promise<void> {
    if (items.length === 0) return;
    await this.prisma.recommendationEvidence.createMany({
      data: items.map((i) => ({
        recommendationId,
        userId,
        dataType: i.dataType,
        summary: i.summary,
        locale: i.locale,
        weight: i.weight ?? null,
      })),
    });
  }

  async listRecommendationEvidence(
    userId: string,
    recommendationId: string,
  ): Promise<RecommendationEvidence[]> {
    return this.prisma.recommendationEvidence.findMany({
      where: { recommendationId, userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Soft-clear AI memory: flip `isActive` to false on every active row.
   * Rows are kept in DB so we can audit "what memory existed at point X" if
   * a user later disputes a recommendation.
   */
  async clearAiMemory(userId: string): Promise<{ cleared: number }> {
    const r = await this.prisma.aiPersonalizationMemory.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });
    return { cleared: r.count };
  }

  async upsertMemory(
    userId: string,
    memoryType: AiMemoryType,
    content: string,
    source: string,
    confidence?: number,
  ): Promise<AiPersonalizationMemory> {
    return this.prisma.aiPersonalizationMemory.create({
      data: {
        userId,
        memoryType,
        content: content.slice(0, 600),
        source,
        confidence: confidence ?? null,
      },
    });
  }

  /**
   * Aggregate every owned row into a JSON document the user can download.
   * Heavy users may produce a large object — for v1 we synchronously build
   * it; an async export-job lands in v1.3 (see docs/PRIVACY_CENTER.md §9).
   */
  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    const [
      profile, settings, consents, schedules, tasks, habits, expenses, incomes,
      wallets, budgets, debts, savingGoals, goals, sleepLogs, moodLogs,
      healthMetrics, mealLogs, aiMessages, aiProviders, memories,
    ] = await this.prisma.$transaction([
      this.prisma.userProfile.findUnique({ where: { userId } }),
      this.prisma.privacySetting.findUnique({ where: { userId } }),
      this.prisma.userConsent.findMany({ where: { userId }, orderBy: { grantedAt: 'asc' } }),
      this.prisma.dailySchedule.findMany({ where: { userId } }),
      this.prisma.task.findMany({ where: { userId } }),
      this.prisma.habit.findMany({ where: { userId }, include: { logs: true } }),
      this.prisma.expense.findMany({ where: { userId } }),
      this.prisma.income.findMany({ where: { userId } }),
      this.prisma.wallet.findMany({ where: { userId } }),
      this.prisma.budget.findMany({ where: { userId } }),
      this.prisma.debt.findMany({ where: { userId } }),
      this.prisma.savingGoal.findMany({ where: { userId } }),
      this.prisma.personalGoal.findMany({ where: { userId }, include: { milestones: true } }),
      this.prisma.sleepLog.findMany({ where: { userId } }),
      this.prisma.moodLog.findMany({ where: { userId } }),
      this.prisma.healthMetric.findMany({ where: { userId } }),
      this.prisma.mealLog.findMany({ where: { userId } }),
      this.prisma.aIMessage.findMany({ where: { userId } }),
      // Strip encryptedApiKey + apiKeyLast4 — exported data must not
      // contain key material even in masked form.
      this.prisma.userAiProvider.findMany({
        where: { userId },
        select: {
          id: true, provider: true, name: true, baseUrl: true,
          defaultChatModel: true, defaultPlannerModel: true,
          defaultFinanceModel: true, defaultMealModel: true,
          defaultHealthModel: true, defaultReportModel: true,
          isActive: true, isDefault: true,
          lastTestedAt: true, lastTestStatus: true,
          createdAt: true, updatedAt: true,
        },
      }),
      this.prisma.aiPersonalizationMemory.findMany({ where: { userId } }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      schemaVersion: '2026-04-25',
      profile,
      privacy: { settings, consents },
      planning: { schedules, tasks, habits },
      meals: { logs: mealLogs },
      wellbeing: { sleepLogs, moodLogs, healthMetrics },
      finance: { wallets, expenses, incomes, budgets, debts, savingGoals },
      goals,
      ai: { messages: aiMessages, providers: aiProviders, memory: memories },
    };
  }
}
