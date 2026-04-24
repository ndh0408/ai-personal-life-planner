import { z } from 'zod';

export const MainGoalSchema = z.enum([
  'LOSE_WEIGHT',
  'GAIN_WEIGHT',
  'SLEEP_EARLY',
  'PRODUCTIVE',
  'STUDY',
  'HEALTHY',
  'BALANCE',
]);

export const ActivityLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);

const HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
export const TimeOfDaySchema = z
  .string()
  .regex(HHMM_REGEX, 'Time must be in HH:mm format (00:00 — 23:59)');

const baseProfileFields = {
  fullName: z.string().min(1).max(120),
  age: z.number().int().min(1).max(120).optional(),
  gender: z.string().max(30).optional(),
  heightCm: z.number().min(50).max(260).optional(),
  weightKg: z.number().min(20).max(400).optional(),
  occupation: z.string().max(100).optional(),
  workStartTime: TimeOfDaySchema.optional(),
  workEndTime: TimeOfDaySchema.optional(),
  usualWakeTime: TimeOfDaySchema.optional(),
  usualSleepTime: TimeOfDaySchema.optional(),
  mainGoal: MainGoalSchema.optional(),
  activityLevel: ActivityLevelSchema.optional(),
  dietaryPreference: z.string().max(120).optional(),
  healthNotes: z.string().max(2000).optional(),
  timezone: z.string().min(1).max(64).optional(),
  locale: z.string().min(2).max(10).optional(),
};

export const CreateProfileSchema = z.object(baseProfileFields);
export type CreateProfileInput = z.infer<typeof CreateProfileSchema>;

export const UpdateProfileSchema = z.object(baseProfileFields).partial();
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
