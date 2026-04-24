import { z } from 'zod';

export const ScheduleStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED']);
export const ScheduleItemTypeSchema = z.enum([
  'SLEEP',
  'MEAL',
  'WORK',
  'STUDY',
  'EXERCISE',
  'REST',
  'TASK',
  'TRAVEL',
  'CUSTOM',
]);
export const ScheduleItemStatusSchema = z.enum(['PENDING', 'COMPLETED', 'SKIPPED', 'DELAYED']);
export const EnergyLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export const MoodSchema = z.enum(['HAPPY', 'NORMAL', 'STRESSED', 'TIRED', 'SAD', 'MOTIVATED']);
export const PrioritySchemaForItem = z.enum(['LOW', 'MEDIUM', 'HIGH']);

const TimeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:mm required');
const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD required');

export const CreateScheduleSchema = z.object({
  date: DateOnly,
  wakeUpTime: TimeOfDay.optional(),
  sleepTime: TimeOfDay.optional(),
  summary: z.string().max(2000).optional(),
  energyLevel: EnergyLevelSchema.optional(),
  mood: MoodSchema.optional(),
  status: ScheduleStatusSchema.optional(),
  aiGenerated: z.boolean().optional(),
});
export type CreateScheduleInput = z.infer<typeof CreateScheduleSchema>;

export const UpdateScheduleSchema = CreateScheduleSchema.partial().omit({ date: true });
export type UpdateScheduleInput = z.infer<typeof UpdateScheduleSchema>;

export const GetScheduleQuerySchema = z.object({
  date: DateOnly,
});
export type GetScheduleQuery = z.infer<typeof GetScheduleQuerySchema>;

export const CreateScheduleItemSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  type: ScheduleItemTypeSchema,
  priority: PrioritySchemaForItem.optional(),
  reason: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).optional(),
  aiGenerated: z.boolean().optional(),
});
export type CreateScheduleItemInput = z.infer<typeof CreateScheduleItemSchema>;

export const UpdateScheduleItemSchema = CreateScheduleItemSchema.partial();
export type UpdateScheduleItemInput = z.infer<typeof UpdateScheduleItemSchema>;

export const PatchScheduleItemStatusSchema = z.object({
  status: ScheduleItemStatusSchema,
});
export type PatchScheduleItemStatusInput = z.infer<typeof PatchScheduleItemStatusSchema>;

export const ReorderScheduleItemsSchema = z.object({
  scheduleId: z.string().uuid(),
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        sortOrder: z.number().int().min(0),
      }),
    )
    .min(1)
    .max(200),
});
export type ReorderScheduleItemsInput = z.infer<typeof ReorderScheduleItemsSchema>;
