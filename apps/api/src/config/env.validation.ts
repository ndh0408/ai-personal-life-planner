import { z } from 'zod';

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),

    DATABASE_URL: z.string().url().refine((u) => u.startsWith('postgres'), {
      message: 'DATABASE_URL must be a PostgreSQL connection string',
    }),

    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

    CORS_ORIGIN: z.string().default('*'),
    THROTTLE_TTL: z.coerce.number().int().positive().default(60),
    THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),

    DEFAULT_LOCALE: z.enum(['vi', 'en']).default('vi'),
    SUPPORTED_LOCALES: z.string().default('vi,en'),

    AI_PROVIDER: z.enum(['anthropic', 'openai', 'mock']).default('mock'),
    AI_API_KEY: z.string().optional(),
    AI_MODEL: z.string().default('claude-sonnet-4-6'),

    // BYOK (Bring-Your-Own-Key) — symmetric key for encrypting user-supplied
    // AI provider API keys at rest. Production builds REFUSE to start without
    // it. Generate with: `openssl rand -hex 32`.
    AI_PROVIDER_ENCRYPTION_KEY: z.string().optional(),
    OPENROUTER_HTTP_REFERER: z.string().url().optional(),
    OPENROUTER_X_TITLE: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.NODE_ENV === 'production') {
      if (!v.CORS_ORIGIN || v.CORS_ORIGIN.trim() === '' || v.CORS_ORIGIN.trim() === '*') {
        ctx.addIssue({
          code: 'custom',
          path: ['CORS_ORIGIN'],
          message: 'CORS_ORIGIN must be a concrete comma-separated origin list in production (no "*").',
        });
      }
      if (v.AI_PROVIDER !== 'mock' && !v.AI_API_KEY) {
        ctx.addIssue({
          code: 'custom',
          path: ['AI_API_KEY'],
          message: `AI_API_KEY is required when AI_PROVIDER is "${v.AI_PROVIDER}" in production.`,
        });
      }
      const accessIsRefresh = v.JWT_ACCESS_SECRET === v.JWT_REFRESH_SECRET;
      if (accessIsRefresh) {
        ctx.addIssue({
          code: 'custom',
          path: ['JWT_REFRESH_SECRET'],
          message: 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ in production.',
        });
      }
      if (!v.AI_PROVIDER_ENCRYPTION_KEY || v.AI_PROVIDER_ENCRYPTION_KEY.trim().length < 32) {
        ctx.addIssue({
          code: 'custom',
          path: ['AI_PROVIDER_ENCRYPTION_KEY'],
          message:
            'AI_PROVIDER_ENCRYPTION_KEY must be set in production (64 hex chars recommended; min 32-char passphrase). Generate via `openssl rand -hex 32`.',
        });
      }
    }
  });

export type AppEnv = z.infer<typeof EnvSchema>;

export function validateEnv(raw: Record<string, unknown>): AppEnv {
  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}
