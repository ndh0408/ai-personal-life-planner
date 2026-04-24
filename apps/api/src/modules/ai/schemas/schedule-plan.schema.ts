import { z } from 'zod';

const TimeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const ItemType = z.enum([
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
const Priority = z.enum(['LOW', 'MEDIUM', 'HIGH']);

export const SchedulePlanSchema = z.object({
  wakeUpTime: TimeOfDay,
  sleepTime: TimeOfDay,
  summary: z.string().min(1).max(2000),
  schedule: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(2000),
        startTime: TimeOfDay,
        endTime: TimeOfDay,
        type: ItemType,
        priority: Priority,
        reason: z.string().max(500),
      }),
    )
    .min(1)
    .max(40),
  warnings: z.array(z.string().max(500)).max(20),
  tips: z.array(z.string().max(500)).max(20),
});
export type SchedulePlan = z.infer<typeof SchedulePlanSchema>;
