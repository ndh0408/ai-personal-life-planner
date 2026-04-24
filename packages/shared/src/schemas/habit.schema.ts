import { z } from 'zod';

export const HabitFrequencySchema = z.enum(['DAILY', 'WEEKLY', 'CUSTOM']);

export const CreateHabitSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  frequency: HabitFrequencySchema.default('DAILY'),
  targetCount: z.number().int().min(1).max(50).default(1),
  color: z.string().max(20).optional(),
  icon: z.string().max(50).optional(),
});
export type CreateHabitInput = z.infer<typeof CreateHabitSchema>;

export const LogHabitSchema = z.object({
  habitId: z.string().uuid(),
  date: z.string().date().optional(),
  completed: z.boolean().default(true),
  count: z.number().int().min(0).max(50).default(1),
  note: z.string().max(500).optional(),
});
export type LogHabitInput = z.infer<typeof LogHabitSchema>;
