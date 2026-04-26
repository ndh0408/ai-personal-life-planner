import { apiClient } from './client';

export type DailyPlanItemType =
  | 'TASK'
  | 'MEAL'
  | 'REST'
  | 'WORK'
  | 'PERSONAL'
  | 'HEALTH'
  | 'FINANCE'
  | 'CUSTOM';
export type DailyPlanItemStatus = 'PENDING' | 'COMPLETED' | 'SKIPPED';

export interface DailyPlanItemPublic {
  id: string;
  title: string;
  startAt: string | null;
  endAt: string | null;
  type: DailyPlanItemType;
  status: DailyPlanItemStatus;
  sortOrder: number;
}

export interface DailyPlanPublic {
  id: string;
  date: string;
  summary: string | null;
  aiGenerated: boolean;
  items: DailyPlanItemPublic[];
}

export interface GenerateResponse {
  plan: DailyPlanPublic;
  generated: number;
}

export const plannerService = {
  today() {
    return apiClient.request<DailyPlanPublic | null>('GET', '/daily-plan/today');
  },
  generateToday() {
    return apiClient.request<GenerateResponse>('POST', '/daily-plan/today/generate');
  },
  setItemStatus(id: string, status: DailyPlanItemStatus) {
    return apiClient.request<DailyPlanItemPublic>(
      'PATCH',
      `/daily-plan/items/${id}/status`,
      { status },
    );
  },
};
