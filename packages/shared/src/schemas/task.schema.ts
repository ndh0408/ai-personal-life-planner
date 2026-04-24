import { z } from 'zod';

export const PrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export const TaskStatusSchema = z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);

export const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priority: PrioritySchema.default('MEDIUM'),
  dueDate: z.string().datetime().optional(),
  estimatedMinutes: z.number().int().positive().max(24 * 60).optional(),
  category: z.string().max(50).optional(),
});
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = CreateTaskSchema.partial().extend({
  status: TaskStatusSchema.optional(),
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

export const PatchTaskStatusSchema = z.object({
  status: TaskStatusSchema,
});
export type PatchTaskStatusInput = z.infer<typeof PatchTaskStatusSchema>;

export const TaskSortSchema = z
  .enum(['createdAt', 'dueDate', 'priority', 'title'])
  .default('createdAt');
export const SortDirectionSchema = z.enum(['asc', 'desc']).default('desc');

const DateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

export const ListTasksQuerySchema = z.object({
  status: TaskStatusSchema.optional(),
  priority: PrioritySchema.optional(),
  /** YYYY-MM-DD — returns tasks whose dueDate falls on that day. */
  dueDate: DateOnlySchema.optional(),
  category: z.string().max(50).optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: TaskSortSchema,
  sortDir: SortDirectionSchema,
});
export type ListTasksQuery = z.infer<typeof ListTasksQuerySchema>;
