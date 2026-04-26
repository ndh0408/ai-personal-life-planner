import { apiClient } from './client';

export type RecommendationType =
  | 'SCHEDULE'
  | 'TASK'
  | 'MEAL'
  | 'SLEEP'
  | 'MOOD'
  | 'FINANCE'
  | 'GENERAL';
export type RecommendationPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type RecommendationStatus = 'NEW' | 'VIEWED' | 'DISMISSED' | 'APPLIED';

export interface RecommendationPublic {
  id: string;
  type: RecommendationType;
  title: string;
  content: string;
  priority: RecommendationPriority;
  status: RecommendationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RefreshResponse {
  generated: number;
  rows: RecommendationPublic[];
}

export const recommendationsService = {
  list() {
    return apiClient.request<RecommendationPublic[]>('GET', '/recommendations');
  },
  refresh() {
    return apiClient.request<RefreshResponse>('POST', '/recommendations/refresh');
  },
  updateStatus(id: string, status: 'VIEWED' | 'DISMISSED' | 'APPLIED') {
    return apiClient.request<RecommendationPublic>(
      'PATCH',
      `/recommendations/${id}/status`,
      { status },
    );
  },
};
