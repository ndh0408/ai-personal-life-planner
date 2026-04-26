import { apiClient } from './client';

export interface MealRow {
  id: string;
  title: string;
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
  cost: number | null;
  loggedAt: string;
}
export interface MealListResponse {
  range: string | null;
  total: number;
  rows: MealRow[];
}

export interface SleepRow {
  id: string;
  sleepAt: string;
  wakeAt: string;
  durationMinutes: number;
  quality: 'BAD' | 'OK' | 'GOOD' | null;
  note: string | null;
  createdAt: string;
}

export interface MoodRow {
  id: string;
  mood: 'GREAT' | 'GOOD' | 'OK' | 'TIRED' | 'STRESSED' | 'SAD';
  energy: 'LOW' | 'MEDIUM' | 'HIGH';
  loggedAt: string;
  note: string | null;
  createdAt: string;
}

export const journalService = {
  meals(range?: 'today' | 'yesterday' | 'week' | 'month') {
    const qs = range ? `?range=${range}` : '';
    return apiClient.request<MealListResponse>('GET', `/meals${qs}`);
  },
  latestSleep() {
    return apiClient.request<SleepRow | null>('GET', '/sleep/latest');
  },
  latestMood() {
    return apiClient.request<MoodRow | null>('GET', '/mood/latest');
  },
};
