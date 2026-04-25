import { api } from './client';
import type {
  PrivacySettingsDto,
  RecordConsentInput,
  UpdatePrivacySettingsInput,
  UserConsentDto,
  UserConsentTypeDto,
} from '@planner/shared';

export interface DataUsageSummary {
  aiSeesSchedule: boolean;
  aiSeesFinance: boolean;
  aiSeesHealth: boolean;
  aiSeesMeal: boolean;
  storedCounts: {
    schedules: number;
    tasks: number;
    expenses: number;
    incomes: number;
    sleepLogs: number;
    moodLogs: number;
    healthMetrics: number;
    aiMessages: number;
  };
  recentConsents: UserConsentDto[];
}

export const privacyApi = {
  getSettings: () => api.get<PrivacySettingsDto>('/privacy/settings'),
  updateSettings: (input: UpdatePrivacySettingsInput) =>
    api.put<PrivacySettingsDto>('/privacy/settings', input),
  listConsents: () => api.get<UserConsentDto[]>('/privacy/consents'),
  recordConsent: (input: RecordConsentInput) =>
    api.post<{ id: string }>('/privacy/consent', input),
  dataUsageSummary: () => api.get<DataUsageSummary>('/privacy/data-usage-summary'),
};

/** Current privacy/ToS policy version surfaced to users on every consent log. */
export const PRIVACY_POLICY_VERSION = '2026-04-25';

export type ConsentType = UserConsentTypeDto;
