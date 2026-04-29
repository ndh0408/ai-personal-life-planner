import { redact, redactUrl } from './redact.util';

describe('redact', () => {
  it('redacts top-level sensitive keys', () => {
    const out = redact({ password: 'p', email: 'a@b.com' });
    expect(out).toEqual({ password: '[redacted]', email: 'a@b.com' });
  });

  it('redacts nested sensitive keys', () => {
    const out = redact({
      headers: { authorization: 'Bearer abc', accept: 'json' },
      body: { username: 'u', refreshToken: 'r' },
    });
    expect(out).toEqual({
      headers: { authorization: '[redacted]', accept: 'json' },
      body: { username: 'u', refreshToken: '[redacted]' },
    });
  });

  it('redacts encryptedApiKey field', () => {
    const out = redact({ encryptedApiKey: 'iv:ct:tag' });
    expect((out as { encryptedApiKey: string }).encryptedApiKey).toBe('[redacted]');
  });

  it('matches case-insensitively', () => {
    const out = redact({ Authorization: 'Bearer x', PASSWORD: 'p', ApiKey: 'k' });
    expect(out).toEqual({ Authorization: '[redacted]', PASSWORD: '[redacted]', ApiKey: '[redacted]' });
  });

  it('walks arrays', () => {
    const out = redact([{ token: 't' }, { name: 'n' }]);
    expect(out).toEqual([{ token: '[redacted]' }, { name: 'n' }]);
  });

  it('preserves primitives, nulls, undefineds', () => {
    expect(redact('hello')).toBe('hello');
    expect(redact(42)).toBe(42);
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
  });

  it('handles Error instances safely', () => {
    const err = new Error('boom');
    const out = redact(err) as { name: string; message: string };
    expect(out.name).toBe('Error');
    expect(out.message).toBe('boom');
  });

  it('caps recursion to avoid runaway loops on cyclic-ish inputs', () => {
    let deep: unknown = { v: 'leaf' };
    for (let i = 0; i < 20; i++) deep = { nested: deep };
    expect(() => redact(deep)).not.toThrow();
  });
});

describe('redactUrl', () => {
  it('strips query strings', () => {
    expect(redactUrl('/api/foo?access_token=abc')).toBe('/api/foo');
  });

  it('keeps URLs without query strings unchanged', () => {
    expect(redactUrl('/api/foo')).toBe('/api/foo');
  });
});
