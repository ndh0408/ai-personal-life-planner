import type { PrivacySetting, UserConsent } from '@prisma/client';
import type { PrivacySettingsDto, UserConsentDto } from '@planner/shared';

export function toPrivacySettingsDto(row: PrivacySetting): PrivacySettingsDto {
  return {
    personalizationEnabled: row.personalizationEnabled,
    useScheduleForAI: row.useScheduleForAI,
    useFinanceForAI: row.useFinanceForAI,
    useHealthForAI: row.useHealthForAI,
    useMealForAI: row.useMealForAI,
    useCalendarContext: row.useCalendarContext,
    useLocationContext: row.useLocationContext,
    useHealthFitnessContext: row.useHealthFitnessContext,
    voiceInputEnabled: row.voiceInputEnabled,
    proactiveRecommendations: row.proactiveRecommendations,
    anonymizedDiagnostics: row.anonymizedDiagnostics,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toUserConsentDto(row: UserConsent): UserConsentDto {
  return {
    id: row.id,
    consentType: row.consentType,
    granted: row.granted,
    version: row.version,
    grantedAt: row.grantedAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
  };
}
