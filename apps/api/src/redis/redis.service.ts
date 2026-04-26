import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Singleton ioredis client. Lazy-connect so a Redis outage at boot does not
 * crash the API — the first command will fail visibly with a clear error.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private _client?: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.getOrThrow<string>('REDIS_URL');
    this._client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });
    this._client.on('error', (e) => this.logger.error(`redis error: ${e.message}`));
    this._client.on('ready', () => this.logger.log('redis ready'));
    void this._client.connect().catch((e) => {
      this.logger.warn(`redis initial connect deferred: ${e.message}`);
    });
  }

  async onModuleDestroy() {
    if (this._client) await this._client.quit().catch(() => undefined);
  }

  get client(): Redis {
    if (!this._client) {
      throw new Error('RedisService used before onModuleInit');
    }
    return this._client;
  }

  async ping(): Promise<'ok' | 'down'> {
    try {
      const r = await this.client.ping();
      return r === 'PONG' ? 'ok' : 'down';
    } catch {
      return 'down';
    }
  }
}
