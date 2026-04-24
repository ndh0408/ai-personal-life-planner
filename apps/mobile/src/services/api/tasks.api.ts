import { api } from './client';
import type {
  CreateTaskInput,
  UpdateTaskInput,
  Priority,
  TaskStatus,
  Task,
} from '@planner/shared';
import type { Paginated } from '../../types';

export type TaskListQuery = {
  status?: TaskStatus;
  priority?: Priority;
  category?: string;
  dueDate?: string; // YYYY-MM-DD
  q?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'dueDate' | 'priority' | 'title';
  sortDir?: 'asc' | 'desc';
};

function qs(params: Record<string, unknown>): string {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') u.append(k, String(v));
  });
  const s = u.toString();
  return s ? `?${s}` : '';
}

export const tasksApi = {
  list: (query: TaskListQuery = {}) => api.get<Paginated<Task>>(`/tasks${qs(query)}`),
  get: (id: string) => api.get<Task>(`/tasks/${id}`),
  create: (input: CreateTaskInput) => api.post<Task>('/tasks', input),
  update: (id: string, input: UpdateTaskInput) => api.put<Task>(`/tasks/${id}`, input),
  setStatus: (id: string, status: TaskStatus) =>
    api.patch<Task>(`/tasks/${id}/status`, { status }),
  remove: (id: string) => api.delete<null>(`/tasks/${id}`),
};
