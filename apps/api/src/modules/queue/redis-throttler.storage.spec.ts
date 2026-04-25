import { RedisThrottlerStorage } from './redis-throttler.storage';
import type { RedisService } from './redis.service';

const stubRedis = {
  isEnabled: () => false,
  isHealthy: () => false,
  getOrNull: () => null,
} as unknown as RedisService;

describe('RedisThrottlerStorage fallback', () => {
  // Use a tiny TTL so the in-memory fallback's setTimeout (it's used to expire
  // the counter) fires inside the test window. Without this, jest reports a
  // leaked handle even with --forceExit.
  const TTL = 50;

  it('uses the in-memory fallback when Redis is disabled', async () => {
    const sut = new RedisThrottlerStorage(stubRedis);
    const r1 = await sut.increment('k1', TTL, 5, 0, 'default');
    const r2 = await sut.increment('k1', TTL, 5, 0, 'default');
    expect(r1.totalHits).toBe(1);
    expect(r2.totalHits).toBe(2);
    expect(r1.isBlocked).toBe(false);
    await new Promise((r) => setTimeout(r, TTL + 20));
  });

  it('isolates per-key state', async () => {
    const sut = new RedisThrottlerStorage(stubRedis);
    const a = await sut.increment('userA', TTL, 5, 0, 'default');
    const b = await sut.increment('userB', TTL, 5, 0, 'default');
    expect(a.totalHits).toBe(1);
    expect(b.totalHits).toBe(1);
    await new Promise((r) => setTimeout(r, TTL + 20));
  });
});
