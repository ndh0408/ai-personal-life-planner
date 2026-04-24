import { api } from './client';
import type { DailySchedule } from './schedules.api';
import { networkStatus } from '../offline/network-status';
import i18n from '../../i18n';

/**
 * Guard every AI request against the offline probe. Throws a structured
 * error that mutation/translate pipelines will surface as a localized
 * "AI is unavailable offline" alert. Centralizing this here means no
 * individual screen can forget to check before firing a prompt.
 */
class OfflineAiBlocked extends Error {
  readonly errorCode = 'AI_OFFLINE';
  constructor() {
    super(i18n.t('offline.ai.blockedBody'));
    this.name = 'OfflineAiBlocked';
  }
}

function assertOnlineForAi(): void {
  if (!networkStatus.get()) throw new OfflineAiBlocked();
}

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
  }) => {
    assertOnlineForAi();
    return api.post<GenerateScheduleResponse>('/ai/generate-schedule', body);
  },
  chat: (body: { conversationId?: string; message: string; contextType?: string }) => {
    assertOnlineForAi();
    return api.post<ChatResponse>('/ai/chat', body);
  },
  weeklyInsight: (body: { weekStart: string }) => {
    assertOnlineForAi();
    return api.post<WeeklyInsightResponse>('/ai/weekly-insight', body);
  },
  suggestMeals: (body: {
    date: string;
    goal?: string;
    budget?: string;
    availableIngredients?: string[];
    cookingTimeMinutes?: number;
    save?: boolean;
  }) => {
    assertOnlineForAi();
    return api.post<{ suggestions: Record<string, unknown>; saved: unknown; usedFallback: boolean }>(
      '/ai/suggest-meals',
      body,
    );
  },
  analyzeFinance: (body: { month: string }) => {
    assertOnlineForAi();
    return api.post<FinanceAnalysisResponse>('/ai/analyze-finance', body);
  },
  dailyReview: (body: { date: string }) => {
    assertOnlineForAi();
    return api.post<DailyReviewResponse>('/ai/daily-review', body);
  },
  reschedule: (body: {
    date: string;
    currentTime: string;
    delayMinutes: number;
    mustKeepItemIds?: string[];
    priorityNote?: string;
  }) => {
    assertOnlineForAi();
    return api.post<ReschedulePreviewResponse>('/ai/reschedule', body);
  },
  applyReschedule: (body: { date: string; previewId: string }) => {
    assertOnlineForAi();
    return api.post<{ id: string } | null>('/ai/apply-reschedule', body);
  },
};

export type ReschedulePreviewResponse = {
  previewId: string;
  preview: {
    summary: string;
    kept: Array<{ id: string; reason: string }>;
    shortened: Array<{ id: string; minutesRemoved: number; reason: string }>;
    removed: Array<{ id: string; reason: string }>;
    warnings: string[];
  };
};
