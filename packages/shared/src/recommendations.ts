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

/**
 * Round 37: structured evidence — the rows / aggregates the engine
 * looked at to produce this nudge. The mobile "Why this?" sheet renders
 * the labels as a list; the value is for the optional secondary line.
 */
export const InsightEvidenceItemSchema = z.object({
  /** Short kicker the UI shows ("Sleep 7-day average"). */
  label: z.string().max(80),
  /** Concrete number / string. ("5h 40m" or "62% of monthly budget"). */
  value: z.string().max(80),
  /** Where the datum came from — UI badges DEVICE / INFERRED / MANUAL. */
  source: z.enum(['MANUAL', 'DEVICE', 'INFERRED', 'COMPUTED']).optional(),
});
export type InsightEvidenceItem = z.infer<typeof InsightEvidenceItemSchema>;

export const RecommendationPublicSchema = z.object({
  id: z.string(),
  type: RecommendationTypeSchema,
  title: z.string(),
  content: z.string(),
  priority: RecommendationPrioritySchema,
  status: RecommendationStatusSchema,
  /** Round 37: one-line "Why this surfaced". Optional for older rows. */
  explainText: z.string().nullable().optional(),
  /** Round 37: structured evidence behind the nudge. */
  evidence: z.array(InsightEvidenceItemSchema).optional(),
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
