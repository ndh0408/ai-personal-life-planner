import { z } from 'zod';

export const DailyPlanItemTypeSchema = z.enum([
  'TASK',
  'MEAL',
  'REST',
  'WORK',
  'PERSONAL',
  'HEALTH',
  'FINANCE',
  'CUSTOM',
]);
export type DailyPlanItemType = z.infer<typeof DailyPlanItemTypeSchema>;

export const DailyPlanItemStatusSchema = z.enum(['PENDING', 'COMPLETED', 'SKIPPED']);
export type DailyPlanItemStatus = z.infer<typeof DailyPlanItemStatusSchema>;

export const DailyPlanItemPublicSchema = z.object({
  id: z.string(),
  title: z.string(),
  startAt: z.string().nullable(),
  endAt: z.string().nullable(),
  type: DailyPlanItemTypeSchema,
  status: DailyPlanItemStatusSchema,
  sortOrder: z.number().int(),
});
export type DailyPlanItemPublic = z.infer<typeof DailyPlanItemPublicSchema>;

export const DailyPlanPublicSchema = z.object({
  id: z.string(),
  date: z.string(), // ISO date string
  summary: z.string().nullable(),
  aiGenerated: z.boolean(),
  items: z.array(DailyPlanItemPublicSchema),
});
export type DailyPlanPublic = z.infer<typeof DailyPlanPublicSchema>;

export const GenerateDailyPlanResponseSchema = z.object({
  plan: DailyPlanPublicSchema,
  generated: z.number().int().nonnegative(),
});
export type GenerateDailyPlanResponse = z.infer<typeof GenerateDailyPlanResponseSchema>;

export const UpdatePlanItemStatusRequestSchema = z.object({
  status: DailyPlanItemStatusSchema,
});
export type UpdatePlanItemStatusRequest = z.infer<typeof UpdatePlanItemStatusRequestSchema>;
