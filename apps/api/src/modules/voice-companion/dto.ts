import type {
  HealthIntegrationSetting,
  SmartCheckinSetting,
  SuggestedAction,
} from '@prisma/client';
import type {
  HealthIntegrationDto,
  SmartCheckinSettingsDto,
  SuggestedActionDto,
  SuggestedActionStatusDto,
  SuggestedActionTypeDto,
} from '@planner/shared';

export function toSmartCheckinSettingsDto(row: SmartCheckinSetting): SmartCheckinSettingsDto {
  return {
    morningCheckinEnabled: row.morningCheckinEnabled,
    mealCheckinEnabled: row.mealCheckinEnabled,
    eveningReviewEnabled: row.eveningReviewEnabled,
    sleepReminderEnabled: row.sleepReminderEnabled,
    financeCheckinEnabled: row.financeCheckinEnabled,
    morningTime: row.morningTime,
    eveningTime: row.eveningTime,
    sleepReminderTime: row.sleepReminderTime,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toSuggestedActionDto(row: SuggestedAction): SuggestedActionDto {
  return {
    id: row.id,
    voiceCaptureId: row.voiceCaptureId,
    type: row.type as SuggestedActionTypeDto,
    title: row.title,
    locale: row.locale,
    confidence: row.confidence,
    payload: (row.payload as Record<string, unknown>) ?? {},
    status: row.status as SuggestedActionStatusDto,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toHealthIntegrationDto(
  row: HealthIntegrationSetting,
): HealthIntegrationDto {
  return {
    provider: row.provider,
    readSleep: row.readSleep,
    readSteps: row.readSteps,
    readExercise: row.readExercise,
    readHeartRate: row.readHeartRate,
    readWeight: row.readWeight,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
    nativeAvailable: false, // v1.3
    updatedAt: row.updatedAt.toISOString(),
  };
}
