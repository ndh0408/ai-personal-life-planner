import { z } from 'zod';

export const HabitFrequencySchema = z.enum(['DAILY', 'WEEKLY', 'CUSTOM']);
const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD required');

export const CreateHabitSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  frequency: HabitFrequencySchema.default('DAILY'),
  targetCount: z.number().int().min(1).max(50).default(1),
  color: z.string().max(20).optional(),
  icon: z.string().max(50).optional(),
});
export type CreateHabitInput = z.infer<typeof CreateHabitSchema>;

export const UpdateHabitSchema = CreateHabitSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateHabitInput = z.infer<typeof UpdateHabitSchema>;

export const LogHabitSchema = z.object({
  date: DateOnly.optional(),
  completed: z.boolean().default(true),
  count: z.number().int().min(0).max(50).default(1),
  note: z.string().max(500).optional(),
});
export type LogHabitInput = z.infer<typeof LogHabitSchema>;

export const HabitLogsQuerySchema = z.object({
  date: DateOnly.optional(),
  habitId: z.string().uuid().optional(),
  from: DateOnly.optional(),
  to: DateOnly.optional(),
});
export type HabitLogsQuery = z.infer<typeof HabitLogsQuerySchema>;
