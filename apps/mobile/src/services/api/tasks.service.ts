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

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  dueAt?: string | null;
  priority?: TaskPriority;
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {
  status?: TaskStatus;
}

export const tasksService = {
  list(range?: 'today' | 'yesterday' | 'week' | 'month') {
    const qs = range ? `?range=${range}` : '';
    return apiClient.request<TaskListResponse>('GET', `/tasks${qs}`);
  },
  create(input: CreateTaskInput) {
    return apiClient.request<TaskRow>('POST', '/tasks', input);
  },
  update(id: string, input: UpdateTaskInput) {
    return apiClient.request<TaskRow>('PUT', `/tasks/${id}`, input);
  },
  complete(id: string) {
    return apiClient.request<TaskRow>('PATCH', `/tasks/${id}/complete`);
  },
  remove(id: string) {
    return apiClient.request<{ id: string }>('DELETE', `/tasks/${id}`);
  },
};
