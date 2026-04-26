import { api } from './client';
import type {
  CreateUserAiProviderInput,
  QuickOpenAiSetupInput,
  UpdateUserAiProviderInput,
  UpdateUserAiPreferenceInput,
  UserAiPreferenceDto,
  UserAiProviderDto,
  UserAiProviderTestResultDto,
} from '@planner/shared';

/**
 * Result of `POST /user-ai-providers/openai-simple`. On success the
 * provider row is returned and is already SUCCESS-tested. On failure
 * `provider` is null (the row was rolled back) and `test` carries the
 * upstream errorCode/message.
 */
export interface QuickOpenAiSetupResultDto {
  provider: UserAiProviderDto | null;
  test: UserAiProviderTestResultDto;
}

export const userAiProvidersApi = {
  list: () => api.get<UserAiProviderDto[]>('/user-ai-providers'),
  create: (input: CreateUserAiProviderInput) =>
    api.post<UserAiProviderDto>('/user-ai-providers', input),
  createOpenAiSimple: (input: QuickOpenAiSetupInput) =>
    api.post<QuickOpenAiSetupResultDto>('/user-ai-providers/openai-simple', input),
  update: (id: string, input: UpdateUserAiProviderInput) =>
    api.put<UserAiProviderDto>(`/user-ai-providers/${id}`, input),
  delete: (id: string) => api.delete<void>(`/user-ai-providers/${id}`),
  test: (id: string) =>
    api.post<UserAiProviderTestResultDto>(`/user-ai-providers/${id}/test`),

  getPreference: () => api.get<UserAiPreferenceDto>('/user-ai-preferences'),
  updatePreference: (input: UpdateUserAiPreferenceInput) =>
    api.put<UserAiPreferenceDto>('/user-ai-preferences', input),
};
