import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Generate a high-entropy URL-safe token + its sha256 hex digest. The raw
 * token is what we email to the user; only the hash is stored in the DB so
 * a DB leak never reveals a usable token.
 */
export function generateAuthToken(byteLength = 32): { raw: string; hash: string } {
  const raw = randomBytes(byteLength).toString('base64url');
  return { raw, hash: hashAuthToken(raw) };
}

export function hashAuthToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

/** Constant-time comparison of two hex digests. */
export function tokenHashesEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}
