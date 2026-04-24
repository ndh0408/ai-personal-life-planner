import { api } from './client';
import type { DailySchedule } from './schedules.api';

export type GenerateScheduleResponse = {
  plan: {
    wakeUpTime: string;
    sleepTime: string;
    summary: string;
    schedule: Array<{
      title: string;
      description: string;
      startTime: string;
      endTime: string;
      type: string;
      priority: string;
      reason: string;
    }>;
    warnings: string[];
    tips: string[];
  };
  saved: DailySchedule | null;
  usedFallback: boolean;
};

export type ChatResponse = {
  conversationId: string;
  reply: {
    answer: string;
    suggestedActions: Array<{ type: string; title: string }>;
  };
  usedFallback: boolean;
};

export type WeeklyInsightResponse = {
  insight: {
    summary: string;
    goodPoints: string[];
    improvementPoints: string[];
    nextWeekSuggestions: string[];
  };
  stats: Record<string, unknown>;
  usedFallback: boolean;
};

export type FinanceAnalysisResponse = {
  analysis: {
    totalIncome: number;
    totalExpense: number;
    remainingMoney: number;
    budgetWarnings: Array<{ category: string; usagePercent: number; message: string }>;
    spendingPatterns: string[];
    savingSuggestions: string[];
    debtSuggestions: string[];
    salaryAllocationSuggestion: {
      needPercent: number;
      wantPercent: number;
      savePercent: number;
      comment: string;
    };
    usefulAdvice: string[];
  };
  context: Record<string, unknown>;
  locale: string;
  usedFallback: boolean;
};

export type DailyReviewResponse = {
  review: {
    todaySummary: string;
    wins: string[];
    issues: string[];
    suggestionsForTomorrow: string[];
    healthAdvice: string;
    financeAdvice: string;
    productivityAdvice: string;
  };
  saved: { id: string } | null;
  locale: string;
  usedFallback: boolean;
};

export const aiApi = {
  generateSchedule: (body: {
    date: string;
    energyLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
    mood?: string;
    extraNote?: string;
  }) => api.post<GenerateScheduleResponse>('/ai/generate-schedule', body),
  chat: (body: { conversationId?: string; message: string; contextType?: string }) =>
    api.post<ChatResponse>('/ai/chat', body),
  weeklyInsight: (body: { weekStart: string }) =>
    api.post<WeeklyInsightResponse>('/ai/weekly-insight', body),
  suggestMeals: (body: {
    date: string;
    goal?: string;
    budget?: string;
    availableIngredients?: string[];
    cookingTimeMinutes?: number;
    save?: boolean;
  }) => api.post<{ suggestions: Record<string, unknown>; saved: unknown; usedFallback: boolean }>(
    '/ai/suggest-meals',
    body,
  ),
  analyzeFinance: (body: { month: string }) =>
    api.post<FinanceAnalysisResponse>('/ai/analyze-finance', body),
  dailyReview: (body: { date: string }) =>
    api.post<DailyReviewResponse>('/ai/daily-review', body),
};
