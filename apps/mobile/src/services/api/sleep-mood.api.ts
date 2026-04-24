import { api } from './client';
import type {
  CreateSleepLogInput,
  CreateMoodLogInput,
  UpdateSleepLogInput,
  UpdateMoodLogInput,
} from '@planner/shared';

export type SleepLog = {
  id: string;
  date: string;
  sleepTime: string;
  wakeTime: string;
  durationMinutes: number;
  quality: 'VERY_BAD' | 'BAD' | 'NORMAL' | 'GOOD' | 'VERY_GOOD';
  note: string | null;
};

export type MoodLog = {
  id: string;
  date: string;
  mood: string;
  energyLevel: string;
  stressLevel: string;
  note: string | null;
};

export const sleepApi = {
  list: (params: { from?: string; to?: string } = {}) => {
    const u = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && u.append(k, v as string));
    const q = u.toString();
    return api.get<SleepLog[]>(`/sleep-logs${q ? `?${q}` : ''}`);
  },
  upsert: (input: CreateSleepLogInput) => api.post<SleepLog>('/sleep-logs', input),
  update: (id: string, input: UpdateSleepLogInput) => api.put<SleepLog>(`/sleep-logs/${id}`, input),
  remove: (id: string) => api.delete<null>(`/sleep-logs/${id}`),
};

export const moodApi = {
  list: (params: { from?: string; to?: string } = {}) => {
    const u = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && u.append(k, v as string));
    const q = u.toString();
    return api.get<MoodLog[]>(`/mood-logs${q ? `?${q}` : ''}`);
  },
  upsert: (input: CreateMoodLogInput) => api.post<MoodLog>('/mood-logs', input),
  update: (id: string, input: UpdateMoodLogInput) => api.put<MoodLog>(`/mood-logs/${id}`, input),
  remove: (id: string) => api.delete<null>(`/mood-logs/${id}`),
};
