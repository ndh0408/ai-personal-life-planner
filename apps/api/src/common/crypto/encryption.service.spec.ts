import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

function svc(env: Record<string, string | undefined>): EncryptionService {
  const config = {
    get: <T>(k: string): T | undefined => env[k] as T | undefined,
  } as unknown as ConfigService;
  return new EncryptionService(config);
}

describe('EncryptionService', () => {
  it('round-trips an arbitrary secret with AES-256-GCM', () => {
    const e = svc({ AI_PROVIDER_ENCRYPTION_KEY: 'a'.repeat(64) });
    const ct = e.encrypt('sk-1234567890abcdef');
    expect(ct.startsWith('v1:')).toBe(true);
    expect(ct).not.toContain('sk-1234567890abcdef');
    expect(e.decrypt(ct)).toBe('sk-1234567890abcdef');
  });

  it('produces unique ciphertexts for the same plaintext (random IV)', () => {
    const e = svc({ AI_PROVIDER_ENCRYPTION_KEY: 'b'.repeat(64) });
    const a = e.encrypt('hello');
    const b = e.encrypt('hello');
    expect(a).not.toBe(b);
    expect(e.decrypt(a)).toBe('hello');
    expect(e.decrypt(b)).toBe('hello');
  });

  it('throws on tampered ciphertext (auth tag rejection)', () => {
    const e = svc({ AI_PROVIDER_ENCRYPTION_KEY: 'c'.repeat(64) });
    const ct = e.encrypt('important');
    const parts = ct.split(':');
    // Flip a byte in the ciphertext segment.
    const tampered = Buffer.from(parts[3], 'base64');
    tampered[0] ^= 0xff;
    parts[3] = tampered.toString('base64');
    expect(() => e.decrypt(parts.join(':'))).toThrow();
  });

  it('refuses ciphertext signed by a different key', () => {
    const e1 = svc({ AI_PROVIDER_ENCRYPTION_KEY: 'd'.repeat(64) });
    const e2 = svc({ AI_PROVIDER_ENCRYPTION_KEY: 'e'.repeat(64) });
    const ct = e1.encrypt('secret');
    expect(() => e2.decrypt(ct)).toThrow();
  });

  it('fails fast in production when key is missing', () => {
    expect(() => svc({ NODE_ENV: 'production' })).toThrow(
      /AI_PROVIDER_ENCRYPTION_KEY/,
    );
  });

  it('falls back to ephemeral random key in dev when missing', () => {
    const e = svc({ NODE_ENV: 'development' });
    expect(e.encrypt('x')).toMatch(/^v1:/);
  });

  it('mask() preserves provider prefix and last 4', () => {
    expect(EncryptionService.mask('sk-1234567890abcdef')).toBe('sk-****cdef');
    expect(EncryptionService.mask('nvapi-zzzzwxyz')).toBe('nvapi-****wxyz');
    expect(EncryptionService.mask('plainkey1234')).toBe('****1234');
  });
});
