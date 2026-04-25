import { api } from './client';
import type {
  HealthIntegrationDto,
  ParseQuickCaptureInput,
  ParseQuickCaptureResultDto,
  QuickMealLogInput,
  QuickMoodLogInput,
  QuickSleepLogInput,
  SmartCheckinSettingsDto,
  SuggestedActionDto,
  TranscribeRequestInput,
  TranscribeResultDto,
  UpdateHealthIntegrationInput,
  UpdateSmartCheckinSettingsInput,
} from '@planner/shared';

export const voiceCompanionApi = {
  // smart check-ins
  getCheckinSettings: () =>
    api.get<SmartCheckinSettingsDto>('/smart-checkins/settings'),
  updateCheckinSettings: (input: UpdateSmartCheckinSettingsInput) =>
    api.put<SmartCheckinSettingsDto>('/smart-checkins/settings', input),

  // health integration
  getHealthIntegration: () =>
    api.get<HealthIntegrationDto>('/health-integration/settings'),
  updateHealthIntegration: (input: UpdateHealthIntegrationInput) =>
    api.put<HealthIntegrationDto>('/health-integration/settings', input),

  // STT (stub today)
  transcribe: (input: TranscribeRequestInput) =>
    api.post<TranscribeResultDto>('/voice/transcribe', input),

  // quick capture
  parseQuickCapture: (input: ParseQuickCaptureInput) =>
    api.post<ParseQuickCaptureResultDto>('/ai/parse-quick-capture', input),
  pendingActions: () => api.get<SuggestedActionDto[]>('/suggested-actions/pending'),
  confirmAction: (id: string, payloadOverride?: Record<string, unknown>) =>
    api.post<SuggestedActionDto>(`/suggested-actions/${id}/confirm`, {
      payloadOverride,
    }),
  rejectAction: (id: string) =>
    api.post<SuggestedActionDto>(`/suggested-actions/${id}/reject`),

  // manual quick logs
  quickMealLog: (input: QuickMealLogInput) =>
    api.post<{ mealLog: unknown; expense: unknown | null }>('/meal-logs/quick', input),
  quickSleepLog: (input: QuickSleepLogInput) =>
    api.post<unknown>('/sleep-logs/quick', input),
  quickMoodLog: (input: QuickMoodLogInput) =>
    api.post<unknown>('/mood-logs/quick', input),
};
