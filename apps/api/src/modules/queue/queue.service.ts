import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, type JobsOptions } from 'bullmq';
import { RedisService } from './redis.service';
import { QUEUE_NAMES, type QueueName } from './queue.constants';

/**
 * Typed wrapper around BullMQ's Queue class. Every feature module talks to
 * this service instead of `new Queue(...)` directly so:
 *  - we share a single Redis connection,
 *  - every enqueue() is no-op-safe when QUEUE_ENABLED=false (local/test),
 *  - default retry/backoff is consistent across queues.
 */
@Injectable()
export class QueueService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(QueueService.name);
  private queues = new Map<QueueName, Queue>();

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (!this.redis.isEnabled()) {
      this.logger.log('QUEUE_ENABLED=false — enqueue() will no-op');
      return;
    }
    const conn = this.redis.getOrNull();
    if (!conn) return;
    for (const name of Object.values(QUEUE_NAMES)) {
      const q = new Queue(name, {
        connection: conn,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 5_000 },
          // keep last 1k completed + 5k failed for debugging without
          // unbounded growth of Redis lists.
          removeOnComplete: { age: 24 * 3600, count: 1000 },
          removeOnFail: { age: 7 * 24 * 3600, count: 5000 },
        },
      });
      this.queues.set(name, q);
    }
    this.logger.log(`Initialised ${this.queues.size} BullMQ queues`);
  }

  async onApplicationShutdown(): Promise<void> {
    for (const [name, q] of this.queues) {
      await q.close().catch((e) => this.logger.warn(`close ${name}: ${e}`));
    }
    this.queues.clear();
  }

  /**
   * Enqueue a job. Returns null when queue layer is disabled — callers should
   * fallback to a synchronous path (or just drop, depending on semantics).
   */
  async enqueue<T = unknown>(
    queue: QueueName,
    jobName: string,
    data: T,
    opts?: JobsOptions,
  ): Promise<{ id: string | undefined } | null> {
    const q = this.queues.get(queue);
    if (!q) return null;
    const job = await q.add(jobName, data as object, opts);
    return { id: job.id };
  }

  getQueue(name: QueueName): Queue | undefined {
    return this.queues.get(name);
  }

  /**
   * Snapshot of waiting/active/failed counts for the metrics endpoint +
   * health indicator. Returns zeros when queue layer is disabled.
   */
  async getCounts(): Promise<Record<QueueName, { waiting: number; active: number; failed: number }>> {
    const out = {} as Record<QueueName, { waiting: number; active: number; failed: number }>;
    for (const name of Object.values(QUEUE_NAMES)) {
      const q = this.queues.get(name);
      if (!q) {
        out[name] = { waiting: 0, active: 0, failed: 0 };
        continue;
      }
      const [waiting, active, failed] = await Promise.all([
        q.getWaitingCount(),
        q.getActiveCount(),
        q.getFailedCount(),
      ]);
      out[name] = { waiting, active, failed };
    }
    return out;
  }
}
