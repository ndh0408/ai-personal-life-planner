import { Injectable } from '@nestjs/common';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { RedisService } from './redis.service';

// `ThrottlerStorageRecord` is the storage-side return value but isn't
// re-exported from the package barrel. Inline it to avoid a deep-path
// import that breaks on a future patch bump.
type ThrottlerStorageRecord = {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
};

/**
 * Redis-backed ThrottlerStorage with safe in-memory fallback.
 *
 * Why a hand-rolled storage rather than `@nest-lab/throttler-storage-redis`?
 *  - Keep one Redis client (RedisService) shared with BullMQ.
 *  - Keep the existing in-memory ThrottlerStorageService as fallback so
 *    local dev and `jest` (no Redis) work unchanged.
 *  - Inline implementation is ~30 lines and avoids another dependency.
 *
 * Algorithm: a fixed-window counter using INCR + EXPIRE. Blocks for
 * `blockDuration` once the counter exceeds `limit` by setting a parallel
 * "blocked" key. Fail-open if Redis errors so a Redis outage degrades
 * gracefully (we'd rather miss a throttle than 500 every request).
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly fallback = new ThrottlerStorageService();

  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    if (!this.redis.isEnabled() || !this.redis.isHealthy()) {
      return this.fallback.increment(key, ttl, limit, blockDuration, throttlerName);
    }
    const client = this.redis.getOrNull();
    if (!client) {
      return this.fallback.increment(key, ttl, limit, blockDuration, throttlerName);
    }
    const ttlSec = Math.max(1, Math.ceil(ttl / 1000));
    const blockSec = Math.max(0, Math.ceil(blockDuration / 1000));
    const counterKey = `throttle:${throttlerName}:${key}`;
    const blockKey = `throttle:${throttlerName}:${key}:blocked`;
    try {
      const blocked = await client.get(blockKey);
      if (blocked) {
        const ttlOnBlock = await client.pttl(blockKey);
        return {
          totalHits: limit + 1,
          timeToExpire: ttlOnBlock > 0 ? ttlOnBlock : 0,
          isBlocked: true,
          timeToBlockExpire: ttlOnBlock > 0 ? ttlOnBlock : 0,
        };
      }
      const totalHits = await client.incr(counterKey);
      if (totalHits === 1) {
        await client.expire(counterKey, ttlSec);
      }
      const remainingMs = (await client.pttl(counterKey)) ?? ttl;
      if (totalHits > limit && blockSec > 0) {
        await client.set(blockKey, '1', 'EX', blockSec);
        return {
          totalHits,
          timeToExpire: remainingMs > 0 ? remainingMs : ttl,
          isBlocked: true,
          timeToBlockExpire: blockSec * 1000,
        };
      }
      return {
        totalHits,
        timeToExpire: remainingMs > 0 ? remainingMs : ttl,
        isBlocked: totalHits > limit,
        timeToBlockExpire: 0,
      };
    } catch {
      // Redis hiccup → degrade to in-memory; do NOT 500 the user.
      return this.fallback.increment(key, ttl, limit, blockDuration, throttlerName);
    }
  }
}
