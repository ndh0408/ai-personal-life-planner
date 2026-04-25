import { Injectable } from '@nestjs/common';
import type { PrivacySetting, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { UpdatePrivacySettingsInput, RecordConsentInput } from '@planner/shared';

/**
 * Default privacy settings for a freshly-registered user.
 *
 * Conservative defaults: AI personalisation domains the user OPTED IN to at
 * signup (schedule/finance/health/meal) start enabled because they're the
 * core product value. Device-permission gates (calendar/location/health-
 * fitness/voice) start DISABLED — the user must explicitly opt in before the
 * app even thinks about prompting the OS for the corresponding permission.
 *
 * Anonymised diagnostics is opt-in: defaults to OFF.
 */
const DEFAULTS = {
  personalizationEnabled: true,
  useScheduleForAI: true,
  useFinanceForAI: true,
  useHealthForAI: true,
  useMealForAI: true,
  useCalendarContext: false,
  useLocationContext: false,
  useHealthFitnessContext: false,
  voiceInputEnabled: false,
  proactiveRecommendations: true,
  anonymizedDiagnostics: false,
};

@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Always returns a row. If the user has never touched their settings we
   * return the in-memory defaults without writing — only the first explicit
   * PUT materialises the row. This keeps the table sparse and avoids a
   * write on every login.
   */
  async getSettings(userId: string): Promise<
    PrivacySetting & { _ephemeral?: true }
  > {
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
    return this.prisma.privacySetting.upsert({
      where: { userId },
      create: { userId, ...DEFAULTS, ...input },
      update: { ...input },
    });
  }

  /**
   * Append a consent event. Revocation is a SECOND row (granted=false), not
   * a mutation of the previous one — preserves an unbroken audit trail.
   * If revoking a still-active grant of the same consentType, mark its
   * `revokedAt` so the timeline reads naturally.
   */
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
   * Snapshot of what the AI currently sees + how much data the user owns.
   * Used by the mobile DataUsageSummaryScreen.
   */
  async dataUsageSummary(userId: string) {
    const settings = await this.getSettings(userId);
    const aiOn = settings.personalizationEnabled;

    const [schedules, tasks, expenses, incomes, sleepLogs, moodLogs, healthMetrics, aiMessages, recentConsents] =
      await Promise.all([
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
      ]);

    return {
      aiSeesSchedule: aiOn && settings.useScheduleForAI,
      aiSeesFinance: aiOn && settings.useFinanceForAI,
      aiSeesHealth: aiOn && settings.useHealthForAI,
      aiSeesMeal: aiOn && settings.useMealForAI,
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
      recentConsents,
    };
  }

  /**
   * Convenience for AI services — returns the in-memory gates as a tiny
   * struct. Used by privacy-aware AI service collectors.
   */
  async aiGates(userId: string): Promise<{
    personalization: boolean;
    schedule: boolean;
    finance: boolean;
    health: boolean;
    meal: boolean;
    calendar: boolean;
    location: boolean;
    healthFitness: boolean;
  }> {
    const s = await this.getSettings(userId);
    return {
      personalization: s.personalizationEnabled,
      schedule: s.personalizationEnabled && s.useScheduleForAI,
      finance: s.personalizationEnabled && s.useFinanceForAI,
      health: s.personalizationEnabled && s.useHealthForAI,
      meal: s.personalizationEnabled && s.useMealForAI,
      calendar: s.personalizationEnabled && s.useCalendarContext,
      location: s.personalizationEnabled && s.useLocationContext,
      healthFitness: s.personalizationEnabled && s.useHealthFitnessContext,
    };
  }
}
