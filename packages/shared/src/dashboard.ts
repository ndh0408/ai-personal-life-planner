import { z } from 'zod';

export const TodayPlanSummarySchema = z.object({
  planId: z.string().nullable(),
  totalItems: z.number().int().nonnegative(),
  doneItems: z.number().int().nonnegative(),
  aiGenerated: z.boolean(),
});
export type TodayPlanSummary = z.infer<typeof TodayPlanSummarySchema>;

export const MoneySummarySchema = z.object({
  todayTotal: z.number().int().nonnegative(),
  weekTotal: z.number().int().nonnegative(),
  walletBalance: z.number(),
  currency: z.literal('VND'),
});
export type MoneySummary = z.infer<typeof MoneySummarySchema>;

export const NextTaskSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    dueAt: z.string().nullable(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  })
  .nullable();
export type NextTask = z.infer<typeof NextTaskSchema>;

export const TopRecommendationSchema = z
  .object({
    id: z.string(),
    type: z.enum(['SCHEDULE', 'TASK', 'MEAL', 'SLEEP', 'MOOD', 'FINANCE', 'GENERAL']),
    title: z.string(),
    content: z.string(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  })
  .nullable();
export type TopRecommendation = z.infer<typeof TopRecommendationSchema>;

export const MoodSleepSummarySchema = z.object({
  lastSleepMinutes: z.number().int().nullable(),
  lastSleepQuality: z.enum(['BAD', 'OK', 'GOOD']).nullable(),
  lastMood: z.enum(['GREAT', 'GOOD', 'OK', 'TIRED', 'STRESSED', 'SAD']).nullable(),
  lastEnergy: z.enum(['LOW', 'MEDIUM', 'HIGH']).nullable(),
});
export type MoodSleepSummary = z.infer<typeof MoodSleepSummarySchema>;

export const DashboardSummarySchema = z.object({
  aiEnabled: z.boolean(),
  todayPlan: TodayPlanSummarySchema,
  money: MoneySummarySchema,
  nextTask: NextTaskSchema,
  topRecommendation: TopRecommendationSchema,
  moodSleep: MoodSleepSummarySchema,
  serverTime: z.string(),
});
export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;
