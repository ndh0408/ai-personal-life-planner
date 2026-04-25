import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis, { type Redis as RedisClient } from 'ioredis';
import { REDIS_KEY_PREFIX } from './queue.constants';

/**
 * Lazy ioredis client. Only constructed when QUEUE_ENABLED=true.
 *
 * - `getOrNull()` returns null when the queue layer is disabled (local dev,
 *   jest). Callers must treat that as "no Redis" and degrade safely.
 * - `getRequired()` throws — use only from sites that already gated on
 *   `isEnabled()`.
 *
 * Connection is shared by every queue/worker so we don't blow past Redis
 * `maxclients` when the API has many feature modules.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClient | null = null;
  private healthy = false;

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return this.config.get<boolean>('QUEUE_ENABLED') === true;
  }

  onModuleInit(): void {
    if (!this.isEnabled()) {
      this.logger.log('QUEUE_ENABLED=false — Redis client not started');
      return;
    }
    const url = this.config.get<string>('REDIS_URL');
    if (!url) {
      this.logger.warn('REDIS_URL missing — queue disabled at runtime');
      return;
    }
    this.client = new IORedis(url, {
      maxRetriesPerRequest: null, // required by BullMQ
      enableReadyCheck: true,
      lazyConnect: false,
      keyPrefix: REDIS_KEY_PREFIX,
    });
    this.client.on('ready', () => {
      this.healthy = true;
      this.logger.log('Redis connected');
    });
    this.client.on('end', () => {
      this.healthy = false;
    });
    this.client.on('error', (err) => {
      this.healthy = false;
      // Avoid log-spam: only WARN; reconnect is automatic.
      this.logger.warn(`Redis error: ${err.message}`);
    });
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client) {
      await this.client.quit().catch(() => undefined);
      this.client = null;
    }
  }

  getOrNull(): RedisClient | null {
    return this.client;
  }

  getRequired(): RedisClient {
    if (!this.client) throw new Error('Redis not configured');
    return this.client;
  }

  isHealthy(): boolean {
    return this.healthy;
  }

  async ping(): Promise<boolean> {
    if (!this.client) return false;
    try {
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }
}
