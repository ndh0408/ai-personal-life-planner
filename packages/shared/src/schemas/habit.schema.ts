import { z } from 'zod';

export const HabitFrequencySchema = z.enum(['daily', 'weekly', 'custom']);

export const CreateHabitSchema = z.object({
  name: z.string().min(1).max(100),
  frequency: HabitFrequencySchema.default('daily'),
  targetPerWeek: z.number().int().min(1).max(7).default(7),
});
export type CreateHabitInput = z.infer<typeof CreateHabitSchema>;

export const LogHabitSchema = z.object({
  habitId: z.string().uuid(),
  note: z.string().max(500).optional(),
  completedAt: z.string().datetime().optional(),
});
export type LogHabitInput = z.infer<typeof LogHabitSchema>;
