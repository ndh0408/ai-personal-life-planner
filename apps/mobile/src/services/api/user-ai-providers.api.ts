import { api } from './client';
import type {
  CreateUserAiProviderInput,
  UpdateUserAiProviderInput,
  UpdateUserAiPreferenceInput,
  UserAiPreferenceDto,
  UserAiProviderDto,
  UserAiProviderTestResultDto,
} from '@planner/shared';

export const userAiProvidersApi = {
  list: () => api.get<UserAiProviderDto[]>('/user-ai-providers'),
  create: (input: CreateUserAiProviderInput) =>
    api.post<UserAiProviderDto>('/user-ai-providers', input),
  update: (id: string, input: UpdateUserAiProviderInput) =>
    api.put<UserAiProviderDto>(`/user-ai-providers/${id}`, input),
  delete: (id: string) => api.delete<void>(`/user-ai-providers/${id}`),
  test: (id: string) =>
    api.post<UserAiProviderTestResultDto>(`/user-ai-providers/${id}/test`),

  getPreference: () => api.get<UserAiPreferenceDto>('/user-ai-preferences'),
  updatePreference: (input: UpdateUserAiPreferenceInput) =>
    api.put<UserAiPreferenceDto>('/user-ai-preferences', input),
};
