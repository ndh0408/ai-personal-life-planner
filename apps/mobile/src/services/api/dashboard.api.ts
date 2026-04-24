import { api } from './client';

export type DashboardSummary = {
  date: string;
  locale: string;
  greeting: { displayName: string };
  assistantHighlight: {
    id: string;
    type: string;
    title: string;
    content: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    createdAt: string;
  } | null;
  todayPlan: {
    hasSchedule: boolean;
    scheduleId: string | null;
    items: number;
    completed: number;
    scheduleStatus: string | null;
  };
  finance: {
    currency: string;
    monthlySalary: number | null;
    totalIncome: number;
    totalExpense: number;
    remaining: number;
    totalCash: number;
    walletsCount: number;
    budgetWarnings: Array<{
      category: string;
      amount: number;
      spent: number;
      usedPercent: number;
      overThreshold: boolean;
    }>;
  };
  health: {
    sleepLatest: { date: string; durationMinutes: number; quality: string } | null;
    moodToday: { mood: string; energyLevel: string; stressLevel: string } | null;
    meals: { planned: number; logged: number; nextPlanned: string | null };
    habits: { active: number; completed: number; logged: number };
  };
  tasks: {
    todayTotal: number;
    todayCompleted: number;
    todayPending: number;
    overdue: number;
    highPriorityOpen: number;
    top: Array<{ id: string; title: string; status: string; priority: string }>;
  };
  goals: {
    activeTotal: number;
    behind: number;
    topSaving: {
      id: string;
      title: string;
      target: number;
      current: number;
      targetDate: string | null;
    } | null;
  };
  scores: {
    scheduleCompletionRate: number | null;
    taskCompletionRate: number | null;
    habitConsistencyRate: number | null;
    sleepConsistencyScore: number | null;
    budgetHealthScore: number | null;
    savingProgressScore: number | null;
    goalProgressScore: number | null;
    energyTrend: 'UP' | 'FLAT' | 'DOWN' | 'UNKNOWN';
    stressTrend: 'UP' | 'FLAT' | 'DOWN' | 'UNKNOWN';
  };
};

export const dashboardApi = {
  summary: (date?: string) =>
    api.get<DashboardSummary>(`/dashboard/summary${date ? `?date=${date}` : ''}`),
};
