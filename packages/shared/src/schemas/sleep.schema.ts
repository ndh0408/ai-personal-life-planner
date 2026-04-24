import { z } from 'zod';

const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD required');
export const SleepQualitySchema = z.enum(['VERY_BAD', 'BAD', 'NORMAL', 'GOOD', 'VERY_GOOD']);

export const CreateSleepLogSchema = z.object({
  date: DateOnly,
  sleepTime: z.string().datetime(),
  wakeTime: z.string().datetime(),
  quality: SleepQualitySchema,
  note: z.string().max(2000).optional(),
});
export type CreateSleepLogInput = z.infer<typeof CreateSleepLogSchema>;

export const UpdateSleepLogSchema = CreateSleepLogSchema.partial().omit({ date: true });
export type UpdateSleepLogInput = z.infer<typeof UpdateSleepLogSchema>;

export const SleepLogsRangeQuerySchema = z
  .object({
    from: DateOnly.optional(),
    to: DateOnly.optional(),
  })
  .refine(
    (q) => !q.from || !q.to || q.from <= q.to,
    { message: '`from` must be <= `to`', path: ['to'] },
  );
export type SleepLogsRangeQuery = z.infer<typeof SleepLogsRangeQuerySchema>;
