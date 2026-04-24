import { z } from 'zod';

const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD required');
export const MoodEnumSchema = z.enum([
  'HAPPY',
  'NORMAL',
  'STRESSED',
  'TIRED',
  'SAD',
  'MOTIVATED',
]);
export const EnergyEnumSchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export const StressLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);

export const CreateMoodLogSchema = z.object({
  date: DateOnly,
  mood: MoodEnumSchema,
  energyLevel: EnergyEnumSchema,
  stressLevel: StressLevelSchema,
  note: z.string().max(2000).optional(),
});
export type CreateMoodLogInput = z.infer<typeof CreateMoodLogSchema>;

export const UpdateMoodLogSchema = CreateMoodLogSchema.partial().omit({ date: true });
export type UpdateMoodLogInput = z.infer<typeof UpdateMoodLogSchema>;

export const MoodLogsRangeQuerySchema = z
  .object({
    from: DateOnly.optional(),
    to: DateOnly.optional(),
  })
  .refine(
    (q) => !q.from || !q.to || q.from <= q.to,
    { message: '`from` must be <= `to`', path: ['to'] },
  );
export type MoodLogsRangeQuery = z.infer<typeof MoodLogsRangeQuerySchema>;
