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
    /** Round 37: one-line "Why this?" rationale. */
    explainText: z.string().nullable().optional(),
    /** Round 37: structured evidence rendered in the rationale sheet. */
    evidence: z
      .array(
        z.object({
          label: z.string(),
          value: z.string(),
          source: z.enum(['MANUAL', 'DEVICE', 'INFERRED', 'COMPUTED']).optional(),
        }),
      )
      .optional(),
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

// ── Round 30: smart brief + suggested captures + privacy hints ──────────────
//
// Surfaces in DashboardSummary that the redesigned Home screen reads to
// render its "command center" hero. All three are optional from the
// client's perspective — older mobile builds ignore them and show the
// classic card grid.

export const SmartBriefToneSchema = z.enum(['neutral', 'gentle', 'urgent', 'celebratory']);
export type SmartBriefTone = z.infer<typeof SmartBriefToneSchema>;

export const SmartBriefActionSchema = z.object({
  /** UI label, ≤ 40 chars to fit in the chip. */
  label: z.string().max(40),
  /** Same shape as AssistantAction screens — let the UI route consistently. */
  screen: z
    .enum(['Today', 'Money', 'Tasks', 'MealLog', 'SleepMoodCheckin', 'AISettings', 'Privacy'])
    .optional(),
  /** Or open SmartEntry pre-filled. */
  smartEntryMode: z.enum(['EXPENSE', 'INCOME', 'TASK', 'MEAL', 'SLEEP', 'MOOD']).optional(),
});
export type SmartBriefAction = z.infer<typeof SmartBriefActionSchema>;

export const SmartBriefSchema = z.object({
  /** One-line summary, ≤ 80 chars. */
  headline: z.string().max(80),
  /** Optional second line with context, ≤ 200 chars. */
  body: z.string().max(200).optional(),
  tone: SmartBriefToneSchema,
  /** Where the brief came from (rules / AI). UI can label "AI" appropriately. */
  source: z.enum(['RULE', 'AI']),
  /** Reason chips — 1-3 short tags ("ngủ thiếu", "vượt ngân sách") so the UI
   *  can show *why* this brief surfaced rather than feeling like magic. */
  reasonLabels: z.array(z.string().max(40)).max(3),
  /** Optional CTA — UI surfaces as a primary button. */
  primaryAction: SmartBriefActionSchema.optional(),
});
export type SmartBrief = z.infer<typeof SmartBriefSchema>;

export const SuggestedCaptureSchema = z.object({
  /** Pre-filled SmartEntry text, ≤ 120 chars. */
  text: z.string().max(120),
  /** Why we suggested it — surfaced as small caption under the chip. */
  reason: z.string().max(80).optional(),
  /** Kind preselect, optional. */
  mode: z.enum(['EXPENSE', 'INCOME', 'TASK', 'MEAL', 'SLEEP', 'MOOD']).optional(),
});
export type SuggestedCapture = z.infer<typeof SuggestedCaptureSchema>;

export const DashboardSummarySchema = z.object({
  aiEnabled: z.boolean(),
  todayPlan: TodayPlanSummarySchema,
  money: MoneySummarySchema,
  nextTask: NextTaskSchema,
  topRecommendation: TopRecommendationSchema,
  moodSleep: MoodSleepSummarySchema,
  serverTime: z.string(),
  /** Round 30: command-center brief. Null when there's nothing salient. */
  smartBrief: SmartBriefSchema.nullable().default(null),
  /** Round 30: 0-3 suggested capture strings to put on Home as chips. */
  suggestedCaptures: z.array(SuggestedCaptureSchema).max(3).default([]),
  /** Round 30: domains the user has hidden — UI can say "AI doesn't see X". */
  privacyLimitedDomains: z.array(z.enum(['finance', 'health', 'meals', 'tasks'])).default([]),
  /**
   * Round 37: adaptive Home card ordering. The server scores each domain
   * by recency-of-need (over budget? sleep deficit? overdue task?) and
   * returns the priority order. Older mobile builds ignore the field and
   * keep their static layout.
   */
  homeOrder: z
    .array(z.enum(['plan', 'money', 'task', 'health', 'mood', 'meal']))
    .default(['plan', 'money', 'task', 'health']),
});
export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;
export type HomeCardKey = z.infer<typeof DashboardSummarySchema>['homeOrder'][number];
