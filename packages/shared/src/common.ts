import { z } from 'zod';

export const LocaleSchema = z.enum(['vi', 'en']);
export type Locale = z.infer<typeof LocaleSchema>;

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  version: z.string(),
  db: z.enum(['ok', 'down']),
  uptimeSec: z.number(),
  timestamp: z.string(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
