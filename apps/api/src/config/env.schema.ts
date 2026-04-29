import { z } from 'zod';

const stringWithDefault = (def: string) =>
  z
    .string()
    .optional()
    .transform((v) => v ?? def);

const intFromString = (def: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? def : Number(v)))
    .refine((v) => Number.isFinite(v) && v > 0, 'must be a positive number');

const boolFromString = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? def : v.toLowerCase() === 'true'));

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: intFromString(4000),

  DATABASE_URL: z.string().url().refine((u) => u.startsWith('postgres'), {
    message: 'DATABASE_URL must be a postgres URL',
  }),

  REDIS_URL: z.string().url().refine((u) => u.startsWith('redis'), {
    message: 'REDIS_URL must start with redis://',
  }),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be ≥ 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be ≥ 32 chars'),
  JWT_ACCESS_TTL: stringWithDefault('15m'),
  JWT_REFRESH_TTL: stringWithDefault('30d'),

  USER_AI_KEY_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'USER_AI_KEY_ENCRYPTION_KEY must be 64 hex chars'),

  OPENAI_BASE_URL: stringWithDefault('https://api.openai.com/v1'),
  // Round 29: feature-level model defaults. FAST is for high-volume, low-stakes
  // calls (capture parser, memory extraction); SMART is for reasoning-heavy
  // calls (assistant chat, planner, recommendations). DEFAULT_MODEL stays
  // as a back-compat fallback for any legacy code path that didn't migrate.
  OPENAI_FAST_MODEL: stringWithDefault('gpt-5.4-mini'),
  OPENAI_SMART_MODEL: stringWithDefault('gpt-5.5'),
  OPENAI_DEFAULT_MODEL: stringWithDefault('gpt-5.4-mini'),

  CORS_ORIGINS: stringWithDefault(''),

  THROTTLE_TTL: intFromString(60),
  THROTTLE_LIMIT: intFromString(100),

  SWAGGER_ENABLED: boolFromString(false),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validate process.env at boot. Throws (fails fast) if anything is missing
 * or malformed. In production we never proceed with a partial config.
 *
 * NOTE: never log the parsed object — it contains secrets. Logging is the
 * caller's responsibility, and ConfigPrinter (config.printer.ts) does it safely.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
