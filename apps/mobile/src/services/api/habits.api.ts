import { api } from './client';
import type { CreateHabitInput, UpdateHabitInput, LogHabitInput, Habit } from '@planner/shared';

export type HabitLog = {
  id: string;
  habitId: string;
  date: string;
  completed: boolean;
  count: number;
  note: string | null;
  habit?: { id: string; name: string; color: string | null; icon: string | null };
};

export const habitsApi = {
  list: () => api.get<Habit[]>('/habits'),
  create: (input: CreateHabitInput) => api.post<Habit>('/habits', input),
  update: (id: string, input: UpdateHabitInput) => api.put<Habit>(`/habits/${id}`, input),
  remove: (id: string) => api.delete<null>(`/habits/${id}`),
  log: (id: string, input: LogHabitInput) => api.post<HabitLog>(`/habits/${id}/log`, input),
  logs: (params: { date?: string; habitId?: string } = {}) => {
    const u = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && u.append(k, v as string));
    const q = u.toString();
    return api.get<HabitLog[]>(`/habits/logs${q ? `?${q}` : ''}`);
  },
};
