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

    // ---- Round 12: queue / worker / observability -------------------------
    // QUEUE_ENABLED gates BullMQ + Redis throttler. When false (default for
    // local dev + jest), the queue API enqueues no-op and the throttler falls
    // back to the existing in-memory storage. Production MUST set true.
    QUEUE_ENABLED: z
      .string()
      .default('false')
      .transform((v) => v === 'true' || v === '1'),
    REDIS_URL: z.string().optional(),
    WORKER_CONCURRENCY_NOTIFICATION: z.coerce.number().int().positive().default(5),
    WORKER_CONCURRENCY_AI: z.coerce.number().int().positive().default(2),
    WORKER_CONCURRENCY_REPORT: z.coerce.number().int().positive().default(2),

    // Metrics + tracing
    METRICS_ENABLED: z
      .string()
      .default('false')
      .transform((v) => v === 'true' || v === '1'),
    METRICS_PATH: z.string().default('/metrics'),
    METRICS_BEARER_TOKEN: z.string().optional(),
    LOG_LEVEL: z.enum(['error', 'warn', 'log', 'debug', 'verbose']).default('log'),
    OTEL_ENABLED: z
      .string()
      .default('false')
      .transform((v) => v === 'true' || v === '1'),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),

    // ---- Round 14 + 17: auth-security email transport ---------------------
    // EMAIL_PROVIDER selects the transport. `console` (default) just logs;
    // `smtp` uses nodemailer with the SMTP_* vars below. Production with
    // EMAIL_PROVIDER=smtp REFUSES to start if SMTP_HOST/USER/PASS/FROM are
    // missing.
    EMAIL_PROVIDER: z.enum(['console', 'smtp']).default('console'),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: z
      .string()
      .default('false')
      .transform((v) => v === 'true' || v === '1'),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().optional(),
    /** Used to build verify-email + reset-password links emailed to users. */
    APP_PUBLIC_URL: z.string().url().optional(),
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
      if (v.QUEUE_ENABLED && !v.REDIS_URL) {
        ctx.addIssue({
          code: 'custom',
          path: ['REDIS_URL'],
          message: 'REDIS_URL is required in production when QUEUE_ENABLED=true.',
        });
      }
      if (v.OTEL_ENABLED && !v.OTEL_EXPORTER_OTLP_ENDPOINT) {
        ctx.addIssue({
          code: 'custom',
          path: ['OTEL_EXPORTER_OTLP_ENDPOINT'],
          message: 'OTEL_EXPORTER_OTLP_ENDPOINT is required when OTEL_ENABLED=true.',
        });
      }
      // Round 17: SMTP fail-fast. EMAIL_PROVIDER=smtp without the four
      // required envs means verification + reset emails would silently
      // fail-open at runtime — refuse boot instead.
      if (v.EMAIL_PROVIDER === 'smtp') {
        for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'] as const) {
          if (!v[key] || String(v[key]).trim() === '') {
            ctx.addIssue({
              code: 'custom',
              path: [key],
              message: `${key} is required when EMAIL_PROVIDER=smtp in production.`,
            });
          }
        }
        if (!v.APP_PUBLIC_URL) {
          ctx.addIssue({
            code: 'custom',
            path: ['APP_PUBLIC_URL'],
            message: 'APP_PUBLIC_URL is required when EMAIL_PROVIDER=smtp (used to build verify/reset links).',
          });
        }
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
