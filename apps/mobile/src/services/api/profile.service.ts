import { apiClient } from './client';

export interface UserProfile {
  preferredName: string | null;
  locale: 'vi' | 'en';
  timezone: string;
  currency: string;
  mainGoals: string[];
  usualWakeTime: string | null;
  usualSleepTime: string | null;
  onboardingCompletedAt: string | null;
  updatedAt: string;
}

export interface UpdateProfileInput {
  preferredName?: string | null;
  locale?: 'vi' | 'en';
  mainGoals?: string[];
  usualWakeTime?: string | null;
  usualSleepTime?: string | null;
  completeOnboarding?: boolean;
}

export const profileService = {
  get() {
    return apiClient.request<UserProfile>('GET', '/profile');
  },
  update(input: UpdateProfileInput) {
    return apiClient.request<UserProfile>('PATCH', '/profile', input);
  },
};
