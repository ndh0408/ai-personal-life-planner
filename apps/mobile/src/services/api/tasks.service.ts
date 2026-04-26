import { apiClient } from './client';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  completedAt: string | null;
  createdAt: string;
}

export interface TaskListResponse {
  range: string | null;
  total: number;
  doneCount: number;
  rows: TaskRow[];
}

export const tasksService = {
  list(range?: 'today' | 'yesterday' | 'week' | 'month') {
    const qs = range ? `?range=${range}` : '';
    return apiClient.request<TaskListResponse>('GET', `/tasks${qs}`);
  },
};
