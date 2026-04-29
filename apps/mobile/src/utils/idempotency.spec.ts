import { makeIdempotencyKey } from './idempotency';

describe('makeIdempotencyKey', () => {
  it('returns a string with the mob_ prefix', () => {
    const key = makeIdempotencyKey();
    expect(typeof key).toBe('string');
    expect(key.startsWith('mob_')).toBe(true);
  });

  it('produces unique keys across rapid invocations', () => {
    const keys = new Set<string>();
    for (let i = 0; i < 1000; i++) keys.add(makeIdempotencyKey());
    // Allow at most a couple collisions; expect well under 1% repeat rate.
    expect(keys.size).toBeGreaterThan(990);
  });

  it('keeps the key inside the server-accepted length range', () => {
    // Server accepts 8..80 chars (see CaptureConfirmRequestSchema).
    for (let i = 0; i < 10; i++) {
      const k = makeIdempotencyKey();
      expect(k.length).toBeGreaterThanOrEqual(8);
      expect(k.length).toBeLessThanOrEqual(80);
    }
  });
});
