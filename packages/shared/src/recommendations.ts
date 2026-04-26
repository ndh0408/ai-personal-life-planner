import { z } from 'zod';

export const RecommendationTypeSchema = z.enum([
  'SCHEDULE',
  'TASK',
  'MEAL',
  'SLEEP',
  'MOOD',
  'FINANCE',
  'GENERAL',
]);
export type RecommendationType = z.infer<typeof RecommendationTypeSchema>;

export const RecommendationPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export type RecommendationPriority = z.infer<typeof RecommendationPrioritySchema>;

export const RecommendationStatusSchema = z.enum(['NEW', 'VIEWED', 'DISMISSED', 'APPLIED']);
export type RecommendationStatus = z.infer<typeof RecommendationStatusSchema>;

export const RecommendationPublicSchema = z.object({
  id: z.string(),
  type: RecommendationTypeSchema,
  title: z.string(),
  content: z.string(),
  priority: RecommendationPrioritySchema,
  status: RecommendationStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type RecommendationPublic = z.infer<typeof RecommendationPublicSchema>;

export const UpdateRecommendationStatusRequestSchema = z.object({
  status: z.enum(['VIEWED', 'DISMISSED', 'APPLIED']),
});
export type UpdateRecommendationStatusRequest = z.infer<
  typeof UpdateRecommendationStatusRequestSchema
>;

export const RefreshRecommendationsResponseSchema = z.object({
  generated: z.number().int().nonnegative(),
  rows: z.array(RecommendationPublicSchema),
});
export type RefreshRecommendationsResponse = z.infer<typeof RefreshRecommendationsResponseSchema>;
