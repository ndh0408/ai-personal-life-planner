import { api } from './client';

export type DailyReport = {
  date: string;
  tasks: {
    total: number;
    byStatus: Record<string, number>;
    totalEstimatedMinutes: number;
    overdue: number;
  };
  habits: { active: number; logged: number; completed: number };
  schedule: {
    id: string;
    status: string;
    items: { total: number; completed: number };
  } | null;
  sleep: { durationMinutes: number; quality: string } | null;
  mood: { mood: string; energyLevel: string; stressLevel: string } | null;
  meals: {
    count: number;
    totalCalories: number;
    totalCost: number;
    items: Array<{
      id: string;
      type: string;
      title: string;
      estimatedCalories: number | null;
      cost: number | null;
    }>;
  };
  spending: {
    total: number;
    byCategory: Record<string, number>;
    topExpenses: Array<{ title: string; amount: number; category: string }>;
  };
};

export type WeeklyReport = {
  weekStart: string;
  weekEnd: string;
  schedule: {
    total: number;
    completed: number;
    completionPercent: number | null;
    byDay: Array<{ date: string; total: number; completed: number }>;
  };
  tasks: { byStatus: Record<string, number> };
  habits: { completed: number; target: number; consistencyPercent: number | null };
  sleep: {
    averageMinutes: number | null;
    entries: Array<{ durationMinutes: number | null; quality: string; date: string }>;
  };
  mood: {
    entries: Array<{ mood: string; energyLevel: string; stressLevel: string; date: string }>;
  };
  meals: { daysLogged: number; total: number };
  spending: {
    total: number;
    byCategory: Record<string, number>;
    byDay: Array<{ date: string; amount: number }>;
  };
  budgetWarnings: Array<{
    id: string;
    category: string;
    amount: number;
    used: number;
    usedPercent: number;
    overThreshold: boolean;
    period: string;
  }>;
  goalProgress: Array<{
    id: string;
    title: string;
    category: string;
    percent: number | null;
    deadline: string | null;
    behindDeadline: boolean;
  }>;
};

export type MonthlyFinanceReport = {
  month: string;
  totals: {
    income: number;
    expense: number;
    saving: number;
    savingRatePercent: number | null;
  };
  byCategory: Record<string, number>;
  byNeedLevel: Record<string, number>;
  budgetUsage: Array<{
    id: string;
    category: string;
    amount: number;
    used: number;
    usedPercent: number;
    overThreshold: boolean;
  }>;
  debts: {
    iOwe: number;
    owedToMe: number;
    items: Array<{
      id: string;
      type: string;
      title: string;
      remaining: number;
      dueDate: string | null;
      status: string;
    }>;
  };
  savingGoals: Array<{
    id: string;
    title: string;
    target: number;
    current: number;
    percent: number;
    targetDate: string | null;
    priority: string;
  }>;
};

export type GoalProgressReport = {
  generatedAt: string;
  byStatus: Record<string, number>;
  averagePercent: number | null;
  behindCount: number;
  goals: Array<{
    id: string;
    title: string;
    category: string;
    priority: string;
    status: string;
    percent: number | null;
    milestones: { total: number; completed: number };
    deadline: string | null;
    behindDeadline: boolean;
  }>;
};

export const reportsApi = {
  daily: (date: string) => api.get<DailyReport>(`/reports/daily?date=${date}`),
  weekly: (weekStart: string) =>
    api.get<WeeklyReport>(`/reports/weekly?weekStart=${weekStart}`),
  monthlyFinance: (month: string) =>
    api.get<MonthlyFinanceReport>(`/reports/monthly-finance?month=${month}`),
  goalProgress: () => api.get<GoalProgressReport>('/reports/goal-progress'),
};
