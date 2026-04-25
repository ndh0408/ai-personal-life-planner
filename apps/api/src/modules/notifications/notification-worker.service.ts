import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, type Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../queue/redis.service';
import { QUEUE_NAMES, NOTIFICATION_JOBS } from '../queue/queue.constants';
import {
  ExpoNotificationProvider,
  type NotificationDeliveryProvider,
} from './expo-notification.provider';
import { NotificationTemplateService } from './notification-template.service';

/**
 * Worker that drains notification-queue and POSTs to the push provider.
 *
 * Decisions made at SEND time (not dispatch time) so a user changing their
 * notification setting between dispatch and delivery is honoured:
 *  - re-read NotificationSetting (master + per-type + quiet hours)
 *  - re-read active devices
 *  - re-render template under user's locale
 *
 * Failure modes:
 *  - INVALID_TOKEN → deactivate the device, mark log SENT (the rest of the
 *    user's devices may still have succeeded)
 *  - PROVIDER_ERROR → throw to let BullMQ retry per defaultJobOptions
 *  - RATE_LIMITED   → throw with a longer hint; BullMQ exponential backoff
 *  - QUIET_HOURS    → reschedule the job past quiet-hours-end instead of
 *    sending now (keeps notification rather than dropping)
 */
@Injectable()
export class NotificationWorkerService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(NotificationWorkerService.name);
  private worker: Worker | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly provider: ExpoNotificationProvider,
    private readonly templates: NotificationTemplateService,
  ) {}

  onModuleInit(): void {
    if (!this.redis.isEnabled()) {
      this.logger.log('queue disabled — notification worker will not start');
      return;
    }
    const conn = this.redis.getOrNull();
    if (!conn) return;
    const concurrency = this.config.get<number>('WORKER_CONCURRENCY_NOTIFICATION') ?? 5;
    this.worker = new Worker(
      QUEUE_NAMES.notification,
      async (job) => this.handle(job, this.provider),
      {
        connection: conn,
        concurrency,
        // BullMQ stallness watchdog (worker died mid-job).
        lockDuration: 30_000,
      },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.warn(`notif job=${job?.id} failed attempt=${job?.attemptsMade}: ${err.message}`);
    });
    this.logger.log(`notification worker started (concurrency=${concurrency})`);
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.worker) {
      await this.worker.close().catch(() => undefined);
      this.worker = null;
    }
  }

  private async handle(job: Job, provider: NotificationDeliveryProvider): Promise<void> {
    const { logId } = job.data as { logId: string };
    const log = await this.prisma.notificationLog.findUnique({
      where: { id: logId },
      include: {
        user: {
          select: {
            id: true,
            notificationSetting: true,
            profile: { select: { locale: true, timezone: true } },
            notificationDevices: { where: { isActive: true } },
          },
        },
      },
    });
    if (!log) return; // already gone
    if (log.status !== 'PENDING') return; // already processed

    const setting = log.user.notificationSetting;
    const devices = log.user.notificationDevices;

    // Master setting check (per-type → boolean field on NotificationSetting).
    if (setting && !respectsTypeSetting(log.type, setting)) {
      await this.markSkipped(log.id, 'SETTING_DISABLED');
      return;
    }
    if (devices.length === 0) {
      await this.markSkipped(log.id, 'NO_DEVICE');
      return;
    }
    // Quiet hours → reschedule, don't drop.
    const tz = log.user.profile?.timezone ?? 'UTC';
    if (setting && isWithinQuietHours(setting, tz)) {
      const delay = msUntilQuietHoursEnd(setting, tz);
      this.logger.debug(`quiet-hours: defer ${log.id} by ${Math.round(delay / 1000)}s`);
      throw new QuietHoursDeferral(delay);
    }

    const locale = log.user.profile?.locale ?? 'vi';
    const rendered = this.templates.render(log.type, locale, {}, log.title, log.body);

    const results = await Promise.all(
      devices.map(async (d) => {
        const r = await provider.send({
          to: d.pushToken,
          title: rendered.title,
          body: rendered.body,
          data: { type: log.type, logId: log.id },
        });
        if (!r.ok && r.reason === 'INVALID_TOKEN') {
          await this.prisma.notificationDevice.update({
            where: { id: d.id },
            data: { isActive: false },
          }).catch(() => undefined);
        }
        return r;
      }),
    );

    const anySuccess = results.some((r) => r.ok);
    const transient = results.some(
      (r) => !r.ok && (r.reason === 'PROVIDER_ERROR' || r.reason === 'RATE_LIMITED'),
    );

    if (anySuccess) {
      await this.prisma.notificationLog.update({
        where: { id: log.id },
        data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 } },
      });
      return;
    }
    if (transient) {
      // Increment attempts; let BullMQ retry per defaultJobOptions.
      await this.prisma.notificationLog.update({
        where: { id: log.id },
        data: { attempts: { increment: 1 }, error: 'PROVIDER_ERROR' },
      });
      throw new Error('provider_transient_error');
    }
    // All devices were INVALID_TOKEN — terminal.
    await this.prisma.notificationLog.update({
      where: { id: log.id },
      data: { status: 'FAILED', error: 'ALL_TOKENS_INVALID', attempts: { increment: 1 } },
    });
  }

  private async markSkipped(id: string, reason: string): Promise<void> {
    await this.prisma.notificationLog.update({
      where: { id },
      data: { status: 'CANCELLED', error: reason, attempts: { increment: 1 } },
    });
  }
}

class QuietHoursDeferral extends Error {
  constructor(public readonly delayMs: number) {
    super(`quiet_hours_defer:${delayMs}`);
  }
}

const TYPE_SETTING_MAP: Record<string, keyof NonNullable<{
  wakeReminder: boolean; sleepReminder: boolean; mealReminder: boolean;
  taskReminder: boolean; habitReminder: boolean; moodCheckinReminder: boolean;
  financeReminder: boolean; budgetAlert: boolean; goalReminder: boolean;
  assistantNudge: boolean;
}>> = {
  'reminder.task': 'taskReminder',
  'reminder.habit': 'habitReminder',
  'reminder.meal': 'mealReminder',
  'reminder.sleep': 'sleepReminder',
  'reminder.mood': 'moodCheckinReminder',
  'finance.budget_alert': 'budgetAlert',
  'goal.progress': 'goalReminder',
  'assistant.nudge': 'assistantNudge',
  'recommendation.high': 'assistantNudge',
  'recommendation.daily': 'assistantNudge',
};

export function respectsTypeSetting(
  type: string,
  setting: {
    wakeReminder: boolean; sleepReminder: boolean; mealReminder: boolean;
    taskReminder: boolean; habitReminder: boolean; moodCheckinReminder: boolean;
    financeReminder: boolean; budgetAlert: boolean; goalReminder: boolean;
    assistantNudge: boolean;
  },
): boolean {
  const key = TYPE_SETTING_MAP[type];
  if (!key) return true; // unmapped types fall through (e.g. 'generic')
  return setting[key] === true;
}

export function isWithinQuietHours(
  setting: { quietHoursStart: Date | null; quietHoursEnd: Date | null },
  timezone: string,
): boolean {
  if (!setting.quietHoursStart || !setting.quietHoursEnd) return false;
  const nowMin = nowMinutesIn(timezone);
  const start = minutesOf(setting.quietHoursStart);
  const end = minutesOf(setting.quietHoursEnd);
  if (start === end) return false;
  if (start < end) return nowMin >= start && nowMin < end;
  // Wrap-around midnight (e.g. 22:00 → 07:00).
  return nowMin >= start || nowMin < end;
}

export function msUntilQuietHoursEnd(
  setting: { quietHoursStart: Date | null; quietHoursEnd: Date | null },
  timezone: string,
): number {
  if (!setting.quietHoursEnd) return 60 * 60_000;
  const nowMin = nowMinutesIn(timezone);
  const end = minutesOf(setting.quietHoursEnd);
  let diff = end - nowMin;
  if (diff <= 0) diff += 24 * 60;
  return diff * 60_000;
}

function nowMinutesIn(timezone: string): number {
  // Intl-based minutes-since-midnight, no extra deps.
  const d = new Date();
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

function minutesOf(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}
