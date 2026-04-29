import { z } from 'zod';
import { LocaleSchema } from './common';

export const WorkPatternSchema = z.enum(['morning', 'evening', 'night-owl', 'flexible']);
export type WorkPattern = z.infer<typeof WorkPatternSchema>;

export const UserProfilePublicSchema = z.object({
  preferredName: z.string().nullable(),
  locale: LocaleSchema,
  timezone: z.string(),
  currency: z.string(),
  mainGoals: z.array(z.string()),
  usualWakeTime: z.string().nullable(),
  usualSleepTime: z.string().nullable(),
  // Round 18 — "understand the user" expansion.
  dislikes: z.array(z.string()),
  allergies: z.array(z.string()),
  monthlyGoal: z.string().nullable(),
  workPattern: WorkPatternSchema.nullable(),
  budgetMonthly: z.number().nullable(),
  onboardingCompletedAt: z.string().nullable(),
  updatedAt: z.string(),
});
export type UserProfilePublic = z.infer<typeof UserProfilePublicSchema>;

const TIME_HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const UpdateProfileRequestSchema = z.object({
  preferredName: z.string().min(1).max(80).nullable().optional(),
  locale: LocaleSchema.optional(),
  mainGoals: z.array(z.string().min(1).max(40)).max(12).optional(),
  usualWakeTime: z.string().regex(TIME_HHMM).nullable().optional(),
  usualSleepTime: z.string().regex(TIME_HHMM).nullable().optional(),
  dislikes: z.array(z.string().min(1).max(80)).max(40).optional(),
  allergies: z.array(z.string().min(1).max(80)).max(40).optional(),
  monthlyGoal: z.string().min(1).max(280).nullable().optional(),
  workPattern: WorkPatternSchema.nullable().optional(),
  budgetMonthly: z.number().min(0).max(1e12).nullable().optional(),
  /** Set to true the first time the onboarding flow finishes. */
  completeOnboarding: z.boolean().optional(),
});
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;
