/**
 * Shared types for the Personal Assistant engine.
 *
 * Signals are the atomic unit: a monitored condition detected against the
 * user's data (e.g. UNDER_SLEPT_3D). A signal carries enough payload for a
 * recommendation template to produce localized title/content, and carries a
 * stable `code` so we can dedupe + route to notifications.
 */

import type {
  AIRecommendationStatus,
  AIRecommendationType,
  Priority,
} from '@prisma/client';

export type SignalSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export type Signal = {
  /** Stable code. Used for dedupe + i18n keys + notification routing. */
  code: SignalCode;
  severity: SignalSeverity;
  /** Serializable data used by the recommendation template. */
  payload: Record<string, unknown>;
};

/**
 * Stable signal code catalog. Mobile maps these to localized icons /
 * illustrations. Never translate these — add new values, don't rename.
 */
export type SignalCode =
  // Schedule / day planning
  | 'SCHEDULE_MISSING'
  | 'SCHEDULE_BEHIND'
  | 'SCHEDULE_OVERLOADED'
  | 'SCHEDULE_FREE_WINDOW'
  // Tasks
  | 'TASKS_DUE_SOON'
  | 'TASK_OVERDUE'
  // Habits
  | 'HABITS_NOT_LOGGED'
  | 'HABIT_DROPPING'
  // Meals
  | 'MEAL_PLAN_MISSING'
  | 'MEAL_SKIPPED_REPEATEDLY'
  // Wellbeing
  | 'UNDER_SLEPT_3D'
  | 'MOOD_CHECKIN_MISSING'
  | 'SLEEP_CHECKIN_MISSING'
  | 'STRESS_HIGH_RECURRING'
  // Finance
  | 'BUDGET_OVER_THRESHOLD'
  | 'SPENDING_ABOVE_BASELINE'
  | 'DEBT_DUE_SOON'
  | 'CASH_LOW_VS_DAYS_LEFT'
  // Goals
  | 'FIN_GOAL_BEHIND'
  | 'PERSONAL_GOAL_BEHIND';

export type PersonalScore = {
  /** 0..100 — completed items in today's schedule. null when no schedule. */
  scheduleCompletionRate: number | null;
  /** 0..100 — tasks completed in the trailing 7d window. */
  taskCompletionRate: number | null;
  /** 0..100 — logged/target across active habits over trailing 7d. */
  habitConsistencyRate: number | null;
  /** 0..100 — low stddev + healthy avg duration in trailing 7d. */
  sleepConsistencyScore: number | null;
  /** 0..100 — 100 = no overload flags this week. */
  workloadBalanceScore: number | null;
  /** 0..100 — % of meals logged vs planned. */
  mealConsistencyScore: number | null;
  /** 0..100 — 100 = no budget over its alert threshold. */
  budgetHealthScore: number | null;
  /** 0..100 — avg progress % across active saving goals. */
  savingProgressScore: number | null;
  /** 0..100 — avg progress % across active personal goals with numeric target. */
  goalProgressScore: number | null;
  /** UP / FLAT / DOWN — last 7d energy moving avg vs prior 7d. */
  energyTrend: Trend;
  /** UP / FLAT / DOWN — last 7d stress moving avg vs prior 7d. */
  stressTrend: Trend;
};

export type Trend = 'UP' | 'FLAT' | 'DOWN' | 'UNKNOWN';

export type CreatedRecommendation = {
  id: string;
  signalCode: SignalCode;
  type: AIRecommendationType;
  priority: Priority;
  status: AIRecommendationStatus;
  title: string;
  content: string;
  createdAt: Date;
  notificationQueued: boolean;
};

export type DailyMonitoringResult = {
  date: string;
  signals: Signal[];
  recommendations: CreatedRecommendation[];
  scores: PersonalScore;
};
