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

export interface TopRecommendation {
  id: string;
  type: 'SCHEDULE' | 'TASK' | 'MEAL' | 'SLEEP' | 'MOOD' | 'FINANCE' | 'GENERAL';
  title: string;
  content: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface MoodSleepSummary {
  lastSleepMinutes: number | null;
  lastSleepQuality: 'BAD' | 'OK' | 'GOOD' | null;
  lastMood: 'GREAT' | 'GOOD' | 'OK' | 'TIRED' | 'STRESSED' | 'SAD' | null;
  lastEnergy: 'LOW' | 'MEDIUM' | 'HIGH' | null;
}

export interface DashboardSummary {
  aiEnabled: boolean;
  todayPlan: TodayPlanSummary;
  money: MoneySummary;
  nextTask: NextTask | null;
  topRecommendation: TopRecommendation | null;
  moodSleep: MoodSleepSummary;
  serverTime: string;
}

export const dashboardService = {
  summary() {
    return apiClient.request<DashboardSummary>('GET', '/dashboard/summary');
  },
};
