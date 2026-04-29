import { apiClient } from './client';

export interface PrivacySettingPublic {
  personalizationEnabled: boolean;
  useFinanceForAI: boolean;
  useHealthForAI: boolean;
  useMealsForAI: boolean;
  useTasksForAI: boolean;
  aiMemoryEnabled: boolean;
  proactiveRecommendations: boolean;
  updatedAt: string;
}

export type UpdatePrivacyRequest = Partial<Omit<PrivacySettingPublic, 'updatedAt'>>;

export const privacyService = {
  get(): Promise<PrivacySettingPublic> {
    return apiClient.request<PrivacySettingPublic>('GET', '/privacy');
  },
  update(input: UpdatePrivacyRequest): Promise<PrivacySettingPublic> {
    return apiClient.request<PrivacySettingPublic>('PATCH', '/privacy', input);
  },
};
