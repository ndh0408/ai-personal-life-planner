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

export interface RecommendationEvidenceItem {
  label: string;
  value: string;
  source?: 'MANUAL' | 'DEVICE' | 'INFERRED' | 'COMPUTED';
}

export interface RecommendationPublic {
  id: string;
  type: RecommendationType;
  title: string;
  content: string;
  priority: RecommendationPriority;
  status: RecommendationStatus;
  /** Round 37: one-line "Why this surfaced". Null on older rows. */
  explainText?: string | null;
  /** Round 37: structured evidence behind the nudge. */
  evidence?: RecommendationEvidenceItem[];
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
