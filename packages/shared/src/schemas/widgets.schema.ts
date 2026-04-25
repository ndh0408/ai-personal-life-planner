import { z } from 'zod';

export const WIDGET_PRIVACY_MODES = ['FULL', 'HIDE_SENSITIVE', 'MINIMAL'] as const;
export const WidgetPrivacyModeSchema = z.enum(WIDGET_PRIVACY_MODES);
export type WidgetPrivacyModeDto = z.infer<typeof WidgetPrivacyModeSchema>;

export const UpdateWidgetPreferencesSchema = z
  .object({
    enabled: z.boolean().optional(),
    showTasks: z.boolean().optional(),
    showRecommendations: z.boolean().optional(),
    showHealthData: z.boolean().optional(),
    showFinance: z.boolean().optional(),
    showFinanceAmounts: z.boolean().optional(),
    privacyMode: WidgetPrivacyModeSchema.optional(),
  })
  .strict();
export type UpdateWidgetPreferencesInput = z.infer<typeof UpdateWidgetPreferencesSchema>;

export interface WidgetPreferencesDto {
  enabled: boolean;
  showTasks: boolean;
  showRecommendations: boolean;
  showHealthData: boolean;
  showFinance: boolean;
  showFinanceAmounts: boolean;
  privacyMode: WidgetPrivacyModeDto;
  updatedAt: string;
}

// ---- The summary payload the widget renders -------------------------------
//
// Rules baked into the SHAPE (not just the field-level renderer):
//   - finance.amounts is ABSENT when showFinanceAmounts=false, regardless of
//     privacy gates. The widget cannot render a number that wasn't sent.
//   - finance.amounts is ABSENT when privacyMode=HIDE_SENSITIVE/MINIMAL.
//   - health is ABSENT entirely when showHealthData=false OR
//     privacyMode=MINIMAL.
//   - topRecommendation is ABSENT when showRecommendations=false OR
//     privacyMode=MINIMAL.
//   - nextTask.title is truncated to 80 chars; never includes raw notes.

export interface WidgetTodaySummaryDto {
  /** Friendly greeting in user locale. */
  greeting: string;
  pendingTaskCount: number;
  /** Locale-tagged "ate breakfast / lunch / dinner" booleans. */
  meals: { breakfast: boolean; lunch: boolean; dinner: boolean };
}

export interface WidgetNextTaskDto {
  id: string;
  title: string;
  dueAt: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | null;
}

export interface WidgetNextScheduleItemDto {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  type: string;
}

export interface WidgetTopRecommendationDto {
  id: string;
  type: string;
  title: string;
  /** Short body, ≤ 200 chars. */
  content: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface WidgetFinanceSummaryDto {
  currency: string;
  /** ABSENT when showFinanceAmounts=false or privacyMode != FULL. */
  amounts?: { totalIncome: number; totalExpense: number; remaining: number };
  /** Always present — proportions are not amount-leaks. */
  budgetWarnings: Array<{ category: string; usagePercent: number }>;
  /** Optional saving-goal headline (% only). */
  savingProgressPercent: number | null;
}

export interface WidgetHealthSummaryDto {
  /** Optional last-night sleep duration in minutes; null if unknown. */
  sleepMinutes: number | null;
  /** Mood / energy from today's check-in if logged. */
  mood: 'HAPPY' | 'NORMAL' | 'STRESSED' | 'TIRED' | 'SAD' | 'MOTIVATED' | null;
  energy: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  hasCheckinToday: boolean;
}

export interface WidgetSummaryDto {
  preferences: WidgetPreferencesDto;
  locale: 'vi' | 'en';
  today: WidgetTodaySummaryDto;
  nextTask: WidgetNextTaskDto | null;
  nextScheduleItem: WidgetNextScheduleItemDto | null;
  /** Absent when showRecommendations=false or privacyMode=MINIMAL. */
  topRecommendation?: WidgetTopRecommendationDto;
  /** Absent when showFinance=false. */
  finance?: WidgetFinanceSummaryDto;
  /** Absent when showHealthData=false or privacyMode=MINIMAL. */
  health?: WidgetHealthSummaryDto;
  widgetUpdatedAt: string;
}
