import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { NOTIFICATION_JOBS, QUEUE_NAMES } from '../queue/queue.constants';

export type DispatchInput = {
  userId: string;
  type: string;
  templateKey?: string;
  /** Free-form fallback when no template is registered. */
  title?: string;
  body?: string;
  /** Per-(user,key) idempotency. Same key inside the dedupe window is dropped. */
  idempotencyKey?: string;
  /** ISO timestamp; used by quiet-hours scheduling. */
  scheduleAt?: Date;
  data?: Record<string, unknown>;
};

/**
 * Owns the "create a notification" verb. Writes a NotificationLog row in
 * PENDING state, then enqueues a job for the worker. NEVER sends inline.
 *
 * - Idempotency: the unique (userId, idempotencyKey) DB constraint blocks
 *   duplicates atomically. We catch P2002 and return the existing row.
 * - Quiet hours: respected by the worker (it re-reads NotificationSetting at
 *   send-time so a user can change settings between dispatch + send).
 * - Queue-disabled local dev: enqueue() is a no-op; the row remains PENDING
 *   and the worker (also disabled) never picks it up — exactly the behaviour
 *   expected for a local environment without Redis.
 */
@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  async dispatch(input: DispatchInput): Promise<{ id: string; deduped: boolean }> {
    const log = await this.upsertPendingLog(input);
    if (log.deduped) return { id: log.id, deduped: true };

    await this.queue.enqueue(
      QUEUE_NAMES.notification,
      NOTIFICATION_JOBS.send,
      { logId: log.id },
      {
        // Use logId as jobId so a retried dispatch (with same row) doesn't
        // create two BullMQ jobs.
        jobId: `send-${log.id}`,
        delay: input.scheduleAt
          ? Math.max(0, input.scheduleAt.getTime() - Date.now())
          : undefined,
      },
    );

    return { id: log.id, deduped: false };
  }

  private async upsertPendingLog(input: DispatchInput): Promise<{ id: string; deduped: boolean }> {
    const baseData = {
      userId: input.userId,
      type: input.type,
      title: input.title ?? input.templateKey ?? input.type,
      body: input.body ?? '',
      idempotencyKey: input.idempotencyKey ?? null,
      scheduledAt: input.scheduleAt ?? null,
      status: 'PENDING' as const,
    };
    if (!input.idempotencyKey) {
      const created = await this.prisma.notificationLog.create({ data: baseData });
      return { id: created.id, deduped: false };
    }
    try {
      const created = await this.prisma.notificationLog.create({ data: baseData });
      return { id: created.id, deduped: false };
    } catch (e: unknown) {
      // P2002 = unique constraint violation on (userId, idempotencyKey).
      const code = (e as { code?: string })?.code;
      if (code === 'P2002') {
        const existing = await this.prisma.notificationLog.findFirst({
          where: { userId: input.userId, idempotencyKey: input.idempotencyKey },
          select: { id: true },
        });
        if (existing) {
          this.logger.debug(`dedupe ${input.idempotencyKey} → ${existing.id}`);
          return { id: existing.id, deduped: true };
        }
      }
      throw e;
    }
  }
}
