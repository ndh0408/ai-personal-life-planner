import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { EncryptionService } from './encryption.service';

function svcWith(keyHex: string | undefined) {
  const config = {
    get: (k: string) => (k === 'USER_AI_KEY_ENCRYPTION_KEY' ? keyHex : undefined),
  } as unknown as ConfigService;
  const svc = new EncryptionService(config);
  svc.onModuleInit();
  return svc;
}

describe('EncryptionService', () => {
  const goodKey = randomBytes(32).toString('hex');

  it('refuses to start without USER_AI_KEY_ENCRYPTION_KEY', () => {
    expect(() => svcWith(undefined)).toThrow(/USER_AI_KEY_ENCRYPTION_KEY is not set/);
  });

  it('refuses a malformed key', () => {
    expect(() => svcWith('not-hex-not-hex-not-hex-not-hex-not-hex-not-hex-not-hex-not-hex-not')).toThrow(/64 hex chars/);
    expect(() => svcWith('aa')).toThrow(/64 hex chars/);
  });

  it('round-trips plaintext', () => {
    const svc = svcWith(goodKey);
    const sealed = svc.seal('sk-test-1234567890abcdef');
    expect(sealed.ciphertext).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(sealed.iv).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(sealed.authTag).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(svc.open(sealed)).toBe('sk-test-1234567890abcdef');
  });

  it('produces a fresh IV every call', () => {
    const svc = svcWith(goodKey);
    const a = svc.seal('hello');
    const b = svc.seal('hello');
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('rejects tampered ciphertext', () => {
    const svc = svcWith(goodKey);
    const sealed = svc.seal('hello');
    const buf = Buffer.from(sealed.ciphertext, 'base64');
    buf[0] = buf[0] ^ 0x01;
    const tampered = { ...sealed, ciphertext: buf.toString('base64') };
    expect(() => svc.open(tampered)).toThrow();
  });

  it('rejects a wrong auth tag', () => {
    const svc = svcWith(goodKey);
    const sealed = svc.seal('hello');
    const tampered = {
      ...sealed,
      authTag: Buffer.alloc(16).toString('base64'),
    };
    expect(() => svc.open(tampered)).toThrow();
  });

  it('a key swap cannot decrypt prior data', () => {
    const svcA = svcWith(goodKey);
    const sealed = svcA.seal('hello');
    const svcB = svcWith(randomBytes(32).toString('hex'));
    expect(() => svcB.open(sealed)).toThrow();
  });
});
