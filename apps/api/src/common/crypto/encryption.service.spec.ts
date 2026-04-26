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

  it('round-trips plaintext as a packed string', () => {
    const svc = svcWith(goodKey);
    const sealed = svc.seal('sk-test-1234567890abcdef');
    expect(sealed).toMatch(/^v1:gcm:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    expect(svc.open(sealed)).toBe('sk-test-1234567890abcdef');
  });

  it('produces a fresh IV every call', () => {
    const svc = svcWith(goodKey);
    const a = svc.seal('hello');
    const b = svc.seal('hello');
    expect(a).not.toBe(b);
  });

  it('rejects tampered ciphertext', () => {
    const svc = svcWith(goodKey);
    const sealed = svc.seal('hello');
    const parts = sealed.split(':');
    const buf = Buffer.from(parts[4], 'base64');
    buf[0] = buf[0] ^ 0x01;
    parts[4] = buf.toString('base64');
    expect(() => svc.open(parts.join(':'))).toThrow();
  });

  it('rejects a wrong auth tag', () => {
    const svc = svcWith(goodKey);
    const sealed = svc.seal('hello');
    const parts = sealed.split(':');
    parts[3] = Buffer.alloc(16).toString('base64');
    expect(() => svc.open(parts.join(':'))).toThrow();
  });

  it('rejects an unknown version tag', () => {
    const svc = svcWith(goodKey);
    const sealed = svc.seal('hello').replace(/^v1:gcm/, 'v2:gcm');
    expect(() => svc.open(sealed)).toThrow(/unrecognised/);
  });

  it('a key swap cannot decrypt prior data', () => {
    const svcA = svcWith(goodKey);
    const sealed = svcA.seal('hello');
    const svcB = svcWith(randomBytes(32).toString('hex'));
    expect(() => svcB.open(sealed)).toThrow();
  });

  it('fingerprint returns last4 and pre-masked display string', () => {
    const fp = EncryptionService.fingerprint('sk-1234567890abcXYZ9');
    expect(fp.last4).toBe('XYZ9');
    expect(fp.masked).toBe('sk-•••••••••XYZ9');
  });
});
