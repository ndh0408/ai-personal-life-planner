import type {
  PrivacySetting,
  RecommendationEvidence,
  UserConsent,
} from '@prisma/client';
import type {
  PrivacySettingsDto,
  RecommendationEvidenceDto,
  UserConsentDto,
} from '@planner/shared';

export function toPrivacySettingsDto(row: PrivacySetting): PrivacySettingsDto {
  return {
    personalizationEnabled: row.personalizationEnabled,
    useScheduleForAI: row.useScheduleForAI,
    useTasksForAI: row.useTasksForAI,
    useHabitsForAI: row.useHabitsForAI,
    useMealsForAI: row.useMealsForAI,
    useMealForAI: row.useMealForAI,
    useHealthForAI: row.useHealthForAI,
    useFinanceForAI: row.useFinanceForAI,
    useGoalsForAI: row.useGoalsForAI,
    useCalendarContext: row.useCalendarContext,
    useLocationContext: row.useLocationContext,
    useHealthFitnessContext: row.useHealthFitnessContext,
    voiceInputEnabled: row.voiceInputEnabled,
    useVoiceInput: row.voiceInputEnabled,
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

export function toRecommendationEvidenceDto(
  row: RecommendationEvidence,
): RecommendationEvidenceDto {
  return {
    id: row.id,
    recommendationId: row.recommendationId,
    dataType: row.dataType,
    summary: row.summary,
    locale: row.locale,
    weight: row.weight,
    createdAt: row.createdAt.toISOString(),
  };
}
