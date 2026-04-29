import { apiClient } from './client';

export interface TodayPlanSummary {
  planId: string | null;
  totalItems: number;
  doneItems: number;
  aiGenerated: boolean;
}

export interface MoneySummary {
  todayTotal: number;
  weekTotal: number;
  walletBalance: number;
  currency: 'VND';
}

export interface NextTask {
  id: string;
  title: string;
  dueAt: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface RecommendationEvidenceLite {
  label: string;
  value: string;
  source?: 'MANUAL' | 'DEVICE' | 'INFERRED' | 'COMPUTED';
}

export interface TopRecommendation {
  id: string;
  type: 'SCHEDULE' | 'TASK' | 'MEAL' | 'SLEEP' | 'MOOD' | 'FINANCE' | 'GENERAL';
  title: string;
  content: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  /** Round 37: surface "Why this?" + evidence for the rationale sheet. */
  explainText?: string | null;
  evidence?: RecommendationEvidenceLite[];
}

export interface MoodSleepSummary {
  lastSleepMinutes: number | null;
  lastSleepQuality: 'BAD' | 'OK' | 'GOOD' | null;
  lastMood: 'GREAT' | 'GOOD' | 'OK' | 'TIRED' | 'STRESSED' | 'SAD' | null;
  lastEnergy: 'LOW' | 'MEDIUM' | 'HIGH' | null;
}

// ── Round 30 additions: smart brief + suggested captures + privacy ──────────

export type SmartEntryMode = 'EXPENSE' | 'INCOME' | 'TASK' | 'MEAL' | 'SLEEP' | 'MOOD';
export type DashboardScreen =
  | 'Today'
  | 'Money'
  | 'Tasks'
  | 'MealLog'
  | 'SleepMoodCheckin'
  | 'AISettings'
  | 'Privacy';

export type SmartBriefTone = 'neutral' | 'gentle' | 'urgent' | 'celebratory';

export interface SmartBriefAction {
  label: string;
  screen?: DashboardScreen;
  smartEntryMode?: SmartEntryMode;
}

export interface SmartBrief {
  headline: string;
  body?: string;
  tone: SmartBriefTone;
  source: 'RULE' | 'AI';
  reasonLabels: string[];
  primaryAction?: SmartBriefAction;
}

export interface SuggestedCapture {
  text: string;
  reason?: string;
  mode?: SmartEntryMode;
}

export type PrivacyLimitedDomain = 'finance' | 'health' | 'meals' | 'tasks';

export type HomeCardKey = 'plan' | 'money' | 'task' | 'health' | 'mood' | 'meal';

export interface DashboardSummary {
  aiEnabled: boolean;
  todayPlan: TodayPlanSummary;
  money: MoneySummary;
  nextTask: NextTask | null;
  topRecommendation: TopRecommendation | null;
  moodSleep: MoodSleepSummary;
  serverTime: string;
  /** Round 30 — null when nothing salient. Older builds ignore. */
  smartBrief?: SmartBrief | null;
  /** Round 30 — 0-3 quick log suggestions. */
  suggestedCaptures?: SuggestedCapture[];
  /** Round 30 — domains the user has hidden from AI. */
  privacyLimitedDomains?: PrivacyLimitedDomain[];
  /** Round 37 — adaptive Home card ordering. */
  homeOrder?: HomeCardKey[];
}

export const dashboardService = {
  summary() {
    return apiClient.request<DashboardSummary>('GET', '/dashboard/summary');
  },
};
