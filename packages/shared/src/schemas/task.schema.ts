import { z } from 'zod';

export const TaskPrioritySchema = z.enum(['low', 'medium', 'high']);
export const TaskStatusSchema = z.enum(['pending', 'in_progress', 'done', 'skipped']);

export const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priority: TaskPrioritySchema.default('medium'),
  dueAt: z.string().datetime().optional(),
  estimatedMinutes: z.number().int().positive().max(24 * 60).optional(),
});
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = CreateTaskSchema.partial().extend({
  status: TaskStatusSchema.optional(),
  scheduledFor: z.string().datetime().nullable().optional(),
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
