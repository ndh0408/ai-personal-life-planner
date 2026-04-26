import type { Env } from './env.schema';

const SECRET_KEYS = new Set<keyof Env>([
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'USER_AI_KEY_ENCRYPTION_KEY',
  'DATABASE_URL',
  'REDIS_URL',
]);

/**
 * Returns a copy of the env safe to log: secrets reduced to a length tag.
 * Never returns the actual secret value.
 */
export function redactEnvForLogging(env: Env): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(env)) {
    if (SECRET_KEYS.has(k as keyof Env)) {
      out[k] = typeof v === 'string' ? `[set, ${v.length} chars]` : '[set]';
    } else {
      out[k] = v;
    }
  }
  return out;
}
