import { generateAuthToken, hashAuthToken, tokenHashesEqual } from './auth-token.util';

describe('auth-token util', () => {
  it('generateAuthToken returns matching hash', () => {
    const { raw, hash } = generateAuthToken();
    expect(hashAuthToken(raw)).toBe(hash);
  });

  it('different raw → different hash', () => {
    const a = generateAuthToken();
    const b = generateAuthToken();
    expect(a.hash).not.toBe(b.hash);
  });

  it('tokenHashesEqual constant-time compare', () => {
    const { hash } = generateAuthToken();
    expect(tokenHashesEqual(hash, hash)).toBe(true);
    expect(tokenHashesEqual(hash, '0'.repeat(hash.length))).toBe(false);
  });
});
