import { apiClient } from './client';

export type WorkPattern = 'morning' | 'evening' | 'night-owl' | 'flexible';

export interface UserProfile {
  preferredName: string | null;
  locale: 'vi' | 'en';
  timezone: string;
  currency: string;
  mainGoals: string[];
  usualWakeTime: string | null;
  usualSleepTime: string | null;
  dislikes: string[];
  allergies: string[];
  monthlyGoal: string | null;
  workPattern: WorkPattern | null;
  budgetMonthly: number | null;
  onboardingCompletedAt: string | null;
  updatedAt: string;
}

export interface UpdateProfileInput {
  preferredName?: string | null;
  locale?: 'vi' | 'en';
  mainGoals?: string[];
  usualWakeTime?: string | null;
  usualSleepTime?: string | null;
  dislikes?: string[];
  allergies?: string[];
  monthlyGoal?: string | null;
  workPattern?: WorkPattern | null;
  budgetMonthly?: number | null;
  completeOnboarding?: boolean;
}

export interface MemoryRow {
  id: string;
  fact: string;
  kind: string;
  weight: number;
  createdAt: string;
}

export const profileService = {
  get() {
    return apiClient.request<UserProfile>('GET', '/profile');
  },
  update(input: UpdateProfileInput) {
    return apiClient.request<UserProfile>('PATCH', '/profile', input);
  },
};

export const memoryService = {
  list() {
    return apiClient.request<MemoryRow[]>('GET', '/memory');
  },
  forget(id: string) {
    return apiClient.request<{ id: string }>('DELETE', `/memory/${id}`);
  },
  confirm(id: string) {
    return apiClient.request<{ id: string; confirmed: boolean }>('POST', `/memory/${id}/confirm`);
  },
};
