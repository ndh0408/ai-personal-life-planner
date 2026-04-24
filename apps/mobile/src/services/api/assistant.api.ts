import { api } from './client';

export type RecommendationStatus = 'NEW' | 'VIEWED' | 'APPLIED' | 'DISMISSED';

export type Recommendation = {
  id: string;
  type: string;
  title: string;
  content: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: RecommendationStatus;
  sourceData: unknown;
  createdAt: string;
};

export type PersonalScore = {
  scheduleCompletionRate: number | null;
  taskCompletionRate: number | null;
  habitConsistencyRate: number | null;
  sleepConsistencyScore: number | null;
  workloadBalanceScore: number | null;
  mealConsistencyScore: number | null;
  budgetHealthScore: number | null;
  savingProgressScore: number | null;
  goalProgressScore: number | null;
  energyTrend: 'UP' | 'FLAT' | 'DOWN' | 'UNKNOWN';
  stressTrend: 'UP' | 'FLAT' | 'DOWN' | 'UNKNOWN';
};

export type AssistantSnapshot = {
  date: string;
  locale: string;
  signalCounts: Record<string, number>;
  signals: Array<{
    code: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    payload: Record<string, unknown>;
  }>;
  scores: PersonalScore;
  recommendations: Recommendation[];
  patterns: {
    tasks: { postponementHours: Array<{ hourBucket: string; count: number }>; worstCategory: { category: string; postponed: number; total: number } | null };
    habits: { bestHabit: string | null; worstHabit: string | null; ranked: Array<{ habitId: string; name: string; completionPercent: number; days: number }> };
    sleep: { lateNightWeekday: number | null; averageDurationMinutes: number | null };
    productivity: { bestHourBucket: string | null };
    spending: { risingCategory: { category: string; recent: number; baseline: number } | null; heaviestWeekday: number | null };
    goals: { stalledGoalIds: string[] };
    overload: { overloadedDays: number };
  };
};

export const assistantApi = {
  today: () => api.get<AssistantSnapshot>('/assistant/today'),
  listRecommendations: (status?: RecommendationStatus, limit?: number) =>
    api.get<Recommendation[]>(
      `/assistant/recommendations${status ? `?status=${status}` : ''}${
        limit ? `${status ? '&' : '?'}limit=${limit}` : ''
      }`,
    ),
  patchStatus: (id: string, status: RecommendationStatus) =>
    api.patch<Recommendation>(`/assistant/recommendations/${id}/status`, { status }),
  runDailyMonitoring: (date?: string) =>
    api.post<AssistantSnapshot>('/assistant/run-daily-monitoring', { date }),
  generateDailyReview: (date: string) =>
    api.post<{ review: DailyReviewOutput; locale: string; usedFallback: boolean }>(
      '/assistant/generate-daily-review',
      { date },
    ),
  generateWeeklyReview: (weekStart: string) =>
    api.post<{ insight: WeeklyInsightOutput; locale: string; usedFallback: boolean }>(
      '/assistant/generate-weekly-review',
      { weekStart },
    ),
};

export type DailyReviewOutput = {
  todaySummary: string;
  wins: string[];
  issues: string[];
  suggestionsForTomorrow: string[];
  healthAdvice: string;
  financeAdvice: string;
  productivityAdvice: string;
};

export type WeeklyInsightOutput = {
  summary: string;
  goodPoints: string[];
  improvementPoints: string[];
  nextWeekSuggestions: string[];
};
