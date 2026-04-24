import { Injectable, Logger } from '@nestjs/common';
import { NotificationStatus, Priority } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { LocaleService } from '../../../common/i18n/locale.service';
import { DailyMonitoringService } from './daily-monitoring.service';
import { LifeInsightService } from './life-insight.service';
import { RecommendationService } from './recommendation.service';
import type {
  CreatedRecommendation,
  DailyMonitoringResult,
  Signal,
  SignalCode,
} from './types';

type RequestLike = { headers?: Record<string, string | string[] | undefined>; locale?: string };

/**
 * The orchestrator — turns monitoring signals into durable recommendations
 * and queues assistant nudges (NotificationLog rows) for HIGH-priority ones
 * when the user opted into push + the time isn't inside quiet hours.
 *
 * Idempotency is delegated to RecommendationService.createFromSignal (dedupe
 * window 24h per signal code). Running this endpoint twice in an hour is
 * safe — you'll get 0 new rows the second time.
 */
@Injectable()
export class ProactiveNudgeService {
  private readonly logger = new Logger(ProactiveNudgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly monitoring: DailyMonitoringService,
    private readonly recommendations: RecommendationService,
    private readonly insights: LifeInsightService,
    private readonly locale: LocaleService,
  ) {}

  async runDaily(userId: string, date: string, req: RequestLike = {}): Promise<DailyMonitoringResult> {
    const localeTag = await this.locale.forUser(userId, req);

    const [signals, scores] = await Promise.all([
      this.monitoring.collect(userId, date),
      this.insights.score(userId, date),
    ]);

    const settings = await this.prisma.notificationSetting.findUnique({
      where: { userId },
    });

    const created: CreatedRecommendation[] = [];
    for (const signal of signals) {
      const row = await this.recommendations.createFromSignal(userId, signal, localeTag);
      let queued = false;
      if (row.created && row.priority === Priority.HIGH) {
        queued = await this.maybeQueueNudge(userId, row.title, row.content, signal, settings);
      }
      created.push({
        id: row.id,
        signalCode: signal.code,
        type: row.type,
        priority: row.priority,
        status: 'NEW',
        title: row.title,
        content: row.content,
        createdAt: row.createdAt,
        notificationQueued: queued,
      });
    }

    this.logger.log(
      `daily-monitoring user=${userId} date=${date} signals=${signals.length} created=${created.filter((r) => r.signalCode && r.createdAt).length}`,
    );

    return { date, signals, recommendations: created, scores };
  }

  private async maybeQueueNudge(
    userId: string,
    title: string,
    body: string,
    signal: Signal,
    settings:
      | {
          assistantNudge: boolean;
          quietHoursStart: Date | null;
          quietHoursEnd: Date | null;
        }
      | null,
  ): Promise<boolean> {
    if (!settings) return false;
    if (!settings.assistantNudge) return false;
    if (isWithinQuietHours(settings.quietHoursStart, settings.quietHoursEnd)) {
      // Defer: schedule for just after the quiet window ends so the user
      // doesn't wake up to a buzz, but still sees the nudge first thing.
      const scheduledAt = nextTimeAfter(settings.quietHoursEnd);
      await this.prisma.notificationLog.create({
        data: {
          userId,
          title,
          body,
          type: `assistant:${signal.code}`,
          scheduledAt,
          status: NotificationStatus.PENDING,
        },
      });
      return true;
    }
    await this.prisma.notificationLog.create({
      data: {
        userId,
        title,
        body,
        type: `assistant:${signal.code}`,
        scheduledAt: new Date(),
        status: NotificationStatus.PENDING,
      },
    });
    return true;
  }

  /**
   * Stateless helper for the /today endpoint — doesn't create anything.
   * Returns live signals + scores + recent recommendation feed.
   */
  async snapshot(userId: string, date: string, req: RequestLike = {}) {
    const [signals, scores, recommendations] = await Promise.all([
      this.monitoring.collect(userId, date),
      this.insights.score(userId, date),
      this.recommendations.list(userId, { limit: 15 }),
    ]);
    const _locale = await this.locale.forUser(userId, req);
    return {
      date,
      locale: _locale,
      signalCounts: countBy(signals.map((s) => s.code)),
      signals,
      scores,
      recommendations,
    };
  }
}

function countBy(codes: SignalCode[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of codes) out[c] = (out[c] ?? 0) + 1;
  return out;
}

function isWithinQuietHours(start: Date | null, end: Date | null): boolean {
  if (!start || !end) return false;
  const now = new Date();
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const startMinutes = start.getUTCHours() * 60 + start.getUTCMinutes();
  const endMinutes = end.getUTCHours() * 60 + end.getUTCMinutes();
  if (startMinutes === endMinutes) return false;
  if (startMinutes < endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }
  // Wrap-around (e.g. 22:30 → 06:00)
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

function nextTimeAfter(quietEnd: Date | null): Date {
  const now = new Date();
  if (!quietEnd) return now;
  const target = new Date(now);
  target.setUTCHours(quietEnd.getUTCHours(), quietEnd.getUTCMinutes(), 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return target;
}
