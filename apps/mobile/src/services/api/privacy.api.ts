import { api } from './client';
import type {
  ClearAiMemoryResultDto,
  DataUsageSummaryDto,
  DeleteAccountRequestDto,
  PrivacySettingsDto,
  RecommendationEvidenceDto,
  RecordConsentInput,
  UpdatePrivacySettingsInput,
  UserConsentDto,
  UserConsentTypeDto,
} from '@planner/shared';

export type DataUsageSummary = DataUsageSummaryDto;

export const privacyApi = {
  getSettings: () => api.get<PrivacySettingsDto>('/privacy/settings'),
  updateSettings: (input: UpdatePrivacySettingsInput) =>
    api.put<PrivacySettingsDto>('/privacy/settings', input),
  listConsents: () => api.get<UserConsentDto[]>('/privacy/consents'),
  recordConsent: (input: RecordConsentInput) =>
    api.post<{ id: string }>('/privacy/consent', input),
  dataUsageSummary: () => api.get<DataUsageSummary>('/privacy/data-usage-summary'),
  recommendationEvidence: (id: string) =>
    api.get<RecommendationEvidenceDto[]>(`/privacy/recommendations/${id}/evidence`),
  exportData: () => api.post<Record<string, unknown>>('/privacy/export-data'),
  clearAiMemory: () => api.post<ClearAiMemoryResultDto>('/privacy/clear-ai-memory'),
  deleteAccountRequest: () =>
    api.post<DeleteAccountRequestDto>('/privacy/delete-account-request'),
};

/** Current privacy/ToS policy version surfaced to users on every consent log. */
export const PRIVACY_POLICY_VERSION = '2026-04-25';

export type ConsentType = UserConsentTypeDto;
