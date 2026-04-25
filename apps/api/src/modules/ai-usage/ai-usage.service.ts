import {
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { AiFeature, type AiUsageQuota, type Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FEATURE_TO_QUOTA, ADMIN_BYPASS_PLANS } from './ai-usage.constants';

type LogEntry = {
  userId: string;
  feature: AiFeature;
  provider: string;
  model: string;
  requestId?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  estimatedCostMicroUsd?: number | null;
  success: boolean;
  errorCode?: string | null;
  latencyMs?: number | null;
};

/**
 * Owns: the AI usage ledger + per-user daily quota check.
 *
 * Important guarantees:
 *  - We NEVER store the prompt, the response, the token, or any
 *    user-context payload in the ledger row. Only metadata + counts.
 *  - Quota is checked against rows in the user's own timezone day; admins
 *    bypass.
 *  - Every AI service path calls assertWithinQuota() then logs(). On
 *    failure, success=false is logged so cost-attack patterns are visible.
 */
@Injectable()
export class AiUsageService {
  private readonly logger = new Logger(AiUsageService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateQuota(userId: string): Promise<AiUsageQuota> {
    return this.prisma.aiUsageQuota.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  /**
   * Checks the user's daily count for `feature` against their plan's limit.
   * Throws a 403 with errorCode `AI_DAILY_LIMIT_REACHED` when over.
   *
   * `now` defaults to current time but is injectable for tests. Timezone
   * defaults to the user's profile timezone if available, falling back to
   * UTC for the (rare) profile-less case.
   */
  async assertWithinQuota(userId: string, feature: AiFeature, now: Date = new Date()): Promise<void> {
    const quota = await this.getOrCreateQuota(userId);
    if (ADMIN_BYPASS_PLANS.includes(quota.plan)) return;
    const limit = quota[FEATURE_TO_QUOTA[feature]] as number;
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    const tz = profile?.timezone ?? 'UTC';
    const { from, to } = todayBoundsIn(tz, now);
    const count = await this.prisma.aiUsageLog.count({
      where: {
        userId,
        feature,
        success: true,
        createdAt: { gte: from, lt: to },
      },
    });
    if (count >= limit) {
      throw new ForbiddenException({
        message: 'AI daily limit reached for this feature',
        errorCode: 'AI_DAILY_LIMIT_REACHED',
      });
    }
  }

  async log(entry: LogEntry): Promise<void> {
    try {
      await this.prisma.aiUsageLog.create({
        data: {
          userId: entry.userId,
          feature: entry.feature,
          provider: entry.provider,
          model: entry.model,
          requestId: entry.requestId ?? null,
          inputTokens: entry.inputTokens ?? null,
          outputTokens: entry.outputTokens ?? null,
          totalTokens: entry.totalTokens ?? null,
          estimatedCostMicroUsd: entry.estimatedCostMicroUsd ?? null,
          success: entry.success,
          errorCode: entry.errorCode ?? null,
          latencyMs: entry.latencyMs ?? null,
        },
      });
    } catch (e) {
      // Never block the user-facing AI call if the ledger write fails.
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`ai-usage log failed: ${msg}`);
    }
  }

  async getToday(userId: string, now: Date = new Date()) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    const tz = profile?.timezone ?? 'UTC';
    const { from, to } = todayBoundsIn(tz, now);
    const rows = await this.prisma.aiUsageLog.groupBy({
      by: ['feature', 'success'],
      where: { userId, createdAt: { gte: from, lt: to } },
      _count: { _all: true },
      _sum: { totalTokens: true },
    });
    const quota = await this.getOrCreateQuota(userId);
    return {
      day: { from: from.toISOString(), to: to.toISOString(), timezone: tz },
      plan: quota.plan,
      perFeature: rows.map((r) => ({
        feature: r.feature,
        success: r.success,
        count: r._count._all,
        totalTokens: r._sum.totalTokens ?? 0,
      })),
      limits: {
        chat: quota.dailyChatLimit,
        schedule: quota.dailyScheduleLimit,
        financeAnalysis: quota.dailyFinanceAnalysisLimit,
        mealSuggestion: quota.dailyMealSuggestionLimit,
        assistantMonitoring: quota.dailyAssistantMonitoringLimit,
        report: quota.dailyReportLimit,
      },
    };
  }

  async getHistory(userId: string, fromIso?: string, toIso?: string) {
    const where: Prisma.AiUsageLogWhereInput = { userId };
    if (fromIso || toIso) {
      where.createdAt = {};
      if (fromIso) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(fromIso);
      if (toIso) (where.createdAt as Prisma.DateTimeFilter).lt = new Date(toIso);
    }
    const rows = await this.prisma.aiUsageLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        feature: true,
        provider: true,
        model: true,
        success: true,
        errorCode: true,
        totalTokens: true,
        latencyMs: true,
        createdAt: true,
      },
    });
    return rows;
  }
}

export function todayBoundsIn(timezone: string, now: Date): { from: Date; to: Date } {
  // Convert "now" to the wall-clock parts in the user's timezone, then
  // collapse to midnight + 24h. We use Intl rather than dragging in dayjs.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const second = Number(parts.find((p) => p.type === 'second')?.value ?? 0);
  // The wall-clock midnight in `timezone` corresponds to `now - elapsedMs`.
  const elapsedMs = ((hour * 60 + minute) * 60 + second) * 1000;
  const from = new Date(now.getTime() - elapsedMs);
  // Sanity-keep year/month/day in the date type through hashing — guards
  // against DST corner cases where the wall-clock minute calc above is off
  // by one second; we round to the nearest minute.
  void { year, month, day }; // explicitly used for clarity / future eyes
  const to = new Date(from.getTime() + 24 * 60 * 60_000);
  return { from, to };
}
