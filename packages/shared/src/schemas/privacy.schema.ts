import { z } from 'zod';

export const USER_CONSENT_TYPES = [
  'TOS',
  'PRIVACY_POLICY',
  'AI_PROCESSING',
  'PERSONALIZATION',
  'DIAGNOSTICS',
  'NOTIFICATIONS',
  'CALENDAR',
  'LOCATION',
  'HEALTH_FITNESS',
  'MICROPHONE',
  'CAMERA',
  'PHOTOS',
] as const;

export const UserConsentTypeSchema = z.enum(USER_CONSENT_TYPES);
export type UserConsentTypeDto = z.infer<typeof UserConsentTypeSchema>;

export interface PrivacySettingsDto {
  personalizationEnabled: boolean;
  useScheduleForAI: boolean;
  useFinanceForAI: boolean;
  useHealthForAI: boolean;
  useMealForAI: boolean;
  useCalendarContext: boolean;
  useLocationContext: boolean;
  useHealthFitnessContext: boolean;
  voiceInputEnabled: boolean;
  proactiveRecommendations: boolean;
  anonymizedDiagnostics: boolean;
  updatedAt: string;
}

export const UpdatePrivacySettingsSchema = z
  .object({
    personalizationEnabled: z.boolean().optional(),
    useScheduleForAI: z.boolean().optional(),
    useFinanceForAI: z.boolean().optional(),
    useHealthForAI: z.boolean().optional(),
    useMealForAI: z.boolean().optional(),
    useCalendarContext: z.boolean().optional(),
    useLocationContext: z.boolean().optional(),
    useHealthFitnessContext: z.boolean().optional(),
    voiceInputEnabled: z.boolean().optional(),
    proactiveRecommendations: z.boolean().optional(),
    anonymizedDiagnostics: z.boolean().optional(),
  })
  .strict();
export type UpdatePrivacySettingsInput = z.infer<typeof UpdatePrivacySettingsSchema>;

export const RecordConsentSchema = z
  .object({
    consentType: UserConsentTypeSchema,
    granted: z.boolean(),
    version: z.string().min(1).max(40),
    metadata: z
      .object({
        source: z.enum(['onboarding', 'settings', 'pre-feature']).optional(),
        platform: z.enum(['ios', 'android', 'web']).optional(),
        locale: z.string().max(10).optional(),
      })
      .partial()
      .strict()
      .optional(),
  })
  .strict();
export type RecordConsentInput = z.infer<typeof RecordConsentSchema>;

export interface UserConsentDto {
  id: string;
  consentType: UserConsentTypeDto;
  granted: boolean;
  version: string;
  grantedAt: string;
  revokedAt: string | null;
  metadata: Record<string, unknown> | null;
}

export interface DataUsageSummaryDto {
  // What domains the app currently sends to AI given the user's settings.
  aiSeesSchedule: boolean;
  aiSeesFinance: boolean;
  aiSeesHealth: boolean;
  aiSeesMeal: boolean;
  // Counts of stored rows so the user knows what data they own. These are
  // intentionally per-domain, not per-row.
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
  // Last consent event per type, for the audit trail UI.
  recentConsents: UserConsentDto[];
}
