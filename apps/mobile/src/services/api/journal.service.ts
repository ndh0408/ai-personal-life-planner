import { apiClient } from './client';

export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
export type Mood = 'GREAT' | 'GOOD' | 'OK' | 'TIRED' | 'STRESSED' | 'SAD';
export type Energy = 'LOW' | 'MEDIUM' | 'HIGH';
export type SleepQuality = 'BAD' | 'OK' | 'GOOD';

export interface MealRow {
  id: string;
  title: string;
  mealType: MealType;
  cost: number | null;
  loggedAt: string;
  note?: string | null;
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
  quality: SleepQuality | null;
  note: string | null;
  createdAt: string;
}

export interface SleepListResponse {
  range: string | null;
  total: number;
  rows: SleepRow[];
}

export interface MoodRow {
  id: string;
  mood: Mood;
  energy: Energy;
  loggedAt: string;
  note: string | null;
  createdAt: string;
}

export interface MoodListResponse {
  range: string | null;
  total: number;
  rows: MoodRow[];
}

export interface CreateMealInput {
  title: string;
  mealType: MealType;
  cost?: number | null;
  loggedAtIso: string;
  note?: string | null;
}

export interface CreateSleepInput {
  sleepAtIso: string;
  wakeAtIso: string;
  quality?: SleepQuality | null;
  note?: string | null;
}

export interface CreateMoodInput {
  mood: Mood;
  energy: Energy;
  loggedAtIso: string;
  note?: string | null;
}

export const journalService = {
  meals(range?: 'today' | 'yesterday' | 'week' | 'month') {
    const qs = range ? `?range=${range}` : '';
    return apiClient.request<MealListResponse>('GET', `/meal-logs${qs}`);
  },
  createMeal(input: CreateMealInput) {
    return apiClient.request<MealRow>('POST', '/meal-logs', input);
  },
  latestSleep() {
    return apiClient.request<SleepRow | null>('GET', '/sleep/latest');
  },
  listSleep(range?: 'today' | 'yesterday' | 'week' | 'month') {
    const qs = range ? `?range=${range}` : '';
    return apiClient.request<SleepListResponse>('GET', `/sleep-logs${qs}`);
  },
  createSleep(input: CreateSleepInput) {
    return apiClient.request<SleepRow>('POST', '/sleep-logs', input);
  },
  latestMood() {
    return apiClient.request<MoodRow | null>('GET', '/mood/latest');
  },
  listMood(range?: 'today' | 'yesterday' | 'week' | 'month') {
    const qs = range ? `?range=${range}` : '';
    return apiClient.request<MoodListResponse>('GET', `/mood-logs${qs}`);
  },
  createMood(input: CreateMoodInput) {
    return apiClient.request<MoodRow>('POST', '/mood-logs', input);
  },
};
