import { api } from './client';
import type {
  ContextInferenceDto,
  ContextInferenceStatusDto,
  ContextTodayDto,
  RunContextInferenceInput,
  UserPatternDto,
} from '@planner/shared';

export const contextApi = {
  today: () => api.get<ContextTodayDto>('/context/today'),
  list: () => api.get<ContextInferenceDto[]>('/context/inferences'),
  patchStatus: (id: string, status: ContextInferenceStatusDto) =>
    api.patch<ContextInferenceDto>(`/context/inferences/${id}/status`, { status }),
  run: (input: RunContextInferenceInput = {}) =>
    api.post<{ inferences: ContextInferenceDto[]; count: number }>('/context/run', input),
  patterns: () => api.get<UserPatternDto[]>('/context/patterns'),
};
