import { z } from 'zod';

export const CONTEXT_INFERENCE_TYPES = [
  'POSSIBLE_SLEEPINESS',
  'WORKLOAD_OVERLOAD',
  'MEAL_MAY_BE_SKIPPED',
  'BUDGET_RISK',
  'TASK_PROCRASTINATION_RISK',
  'HABIT_DROP_RISK',
  'LOW_ENERGY_DAY',
  'NEED_REVIEW_DAY',
] as const;
export const ContextInferenceTypeSchema = z.enum(CONTEXT_INFERENCE_TYPES);
export type ContextInferenceTypeDto = z.infer<typeof ContextInferenceTypeSchema>;

export const CONTEXT_INFERENCE_STATUSES = [
  'NEW',
  'VIEWED',
  'DISMISSED',
  'APPLIED',
] as const;
export const ContextInferenceStatusSchema = z.enum(CONTEXT_INFERENCE_STATUSES);
export type ContextInferenceStatusDto = z.infer<typeof ContextInferenceStatusSchema>;

export const USER_PATTERN_TYPES = [
  'USUAL_SLEEP_TIME',
  'USUAL_WAKE_TIME',
  'USUAL_MEAL_TIME_BREAKFAST',
  'USUAL_MEAL_TIME_LUNCH',
  'USUAL_MEAL_TIME_DINNER',
  'USUAL_HABIT_TIME',
  'USUAL_PRODUCTIVE_HOURS',
  'COMMON_OVERLOAD_DAYS',
  'COMMON_SKIPPED_TASK_CATEGORY',
  'AVG_DAILY_EXPENSE',
] as const;
export const UserPatternTypeSchema = z.enum(USER_PATTERN_TYPES);
export type UserPatternTypeDto = z.infer<typeof UserPatternTypeSchema>;

export interface ContextEvidenceItemDto {
  /** Stable key the mobile may use to swap copy (e.g. "usualSleepTime"). */
  key: string;
  /** Locale-tagged human summary the user reads. NEVER raw amounts/notes. */
  summary: string;
}

export interface ContextInferenceDto {
  id: string;
  type: ContextInferenceTypeDto;
  confidence: number;
  evidence: { locale: string; items: ContextEvidenceItemDto[] };
  /** Optional structured action the mobile UI may render as a Quick Action. */
  suggestedAction: { type: string; [k: string]: unknown } | null;
  status: ContextInferenceStatusDto;
  createdAt: string;
  updatedAt: string;
}

export interface ContextSignalDto {
  id: string;
  type: string;
  source: string;
  confidence: number | null;
  occurredAt: string;
  value: Record<string, unknown>;
}

export interface UserPatternDto {
  id: string;
  patternType: UserPatternTypeDto;
  value: Record<string, unknown>;
  confidence: number;
  lastObservedAt: string;
}

export const UpdateContextInferenceStatusSchema = z
  .object({ status: ContextInferenceStatusSchema })
  .strict();
export type UpdateContextInferenceStatusInput = z.infer<
  typeof UpdateContextInferenceStatusSchema
>;

export const RunContextInferenceSchema = z
  .object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })
  .strict();
export type RunContextInferenceInput = z.infer<typeof RunContextInferenceSchema>;

export interface ContextTodayDto {
  inferences: ContextInferenceDto[];
  patterns: UserPatternDto[];
  /** Counts of disabled signal sources per privacy gate (UI hint). */
  disabledByPrivacy: {
    health: boolean;
    finance: boolean;
    schedule: boolean;
    meal: boolean;
  };
}
