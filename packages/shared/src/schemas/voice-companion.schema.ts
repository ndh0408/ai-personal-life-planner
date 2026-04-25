import { z } from 'zod';

// ---- Smart check-in settings ---------------------------------------------

export const UpdateSmartCheckinSettingsSchema = z
  .object({
    morningCheckinEnabled: z.boolean().optional(),
    mealCheckinEnabled: z.boolean().optional(),
    eveningReviewEnabled: z.boolean().optional(),
    sleepReminderEnabled: z.boolean().optional(),
    financeCheckinEnabled: z.boolean().optional(),
    morningTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
    eveningTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
    sleepReminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  })
  .strict();
export type UpdateSmartCheckinSettingsInput = z.infer<typeof UpdateSmartCheckinSettingsSchema>;

export interface SmartCheckinSettingsDto {
  morningCheckinEnabled: boolean;
  mealCheckinEnabled: boolean;
  eveningReviewEnabled: boolean;
  sleepReminderEnabled: boolean;
  financeCheckinEnabled: boolean;
  morningTime: string;
  eveningTime: string;
  sleepReminderTime: string;
  updatedAt: string;
}

// ---- Quick capture --------------------------------------------------------

export const VOICE_CAPTURE_SOURCES = [
  'PUSH_TO_TALK',
  'QUICK_NOTE',
  'OS_SHORTCUT',
  'TEXT_FALLBACK',
] as const;
export const VoiceCaptureSourceSchema = z.enum(VOICE_CAPTURE_SOURCES);
export type VoiceCaptureSourceDto = z.infer<typeof VoiceCaptureSourceSchema>;

export const ParseQuickCaptureSchema = z
  .object({
    transcript: z.string().min(1).max(2000),
    source: VoiceCaptureSourceSchema.default('TEXT_FALLBACK'),
    locale: z.enum(['vi', 'en']).optional(),
  })
  .strict();
export type ParseQuickCaptureInput = z.infer<typeof ParseQuickCaptureSchema>;

export const SUGGESTED_ACTION_TYPES = [
  'ADD_TASK',
  'ADD_EXPENSE',
  'ADD_INCOME',
  'ADD_MEAL_LOG',
  'ADD_SLEEP_LOG',
  'ADD_MOOD_LOG',
  'CREATE_REMINDER',
  'GENERATE_SCHEDULE',
  'RESCHEDULE_TODAY',
  'SAVE_MEMORY',
  'ASK_FOLLOWUP',
] as const;
export const SuggestedActionTypeSchema = z.enum(SUGGESTED_ACTION_TYPES);
export type SuggestedActionTypeDto = z.infer<typeof SuggestedActionTypeSchema>;

export const SUGGESTED_ACTION_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'REJECTED',
  'EXPIRED',
] as const;
export const SuggestedActionStatusSchema = z.enum(SUGGESTED_ACTION_STATUSES);
export type SuggestedActionStatusDto = z.infer<typeof SuggestedActionStatusSchema>;

export interface SuggestedActionDto {
  id: string;
  voiceCaptureId: string | null;
  type: SuggestedActionTypeDto;
  title: string;
  locale: string;
  confidence: number | null;
  payload: Record<string, unknown>;
  status: SuggestedActionStatusDto;
  expiresAt: string | null;
  createdAt: string;
}

export interface ParseQuickCaptureResultDto {
  voiceCaptureId: string;
  /** Locale-tagged short follow-up question when the AI confidence was low. */
  followupQuestion: string | null;
  actions: SuggestedActionDto[];
  /** True when the parser fell back to a deterministic safe response. */
  usedFallback: boolean;
}

export const ConfirmSuggestedActionSchema = z
  .object({
    /** Optional override for free-form fields (e.g. user edits the parsed amount). */
    payloadOverride: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export type ConfirmSuggestedActionInput = z.infer<typeof ConfirmSuggestedActionSchema>;

// ---- Quick-log inputs (manual + voice-derived) ----------------------------

export const QuickMealLogSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']),
    title: z.string().min(1).max(200),
    estimatedCost: z.number().nonnegative().max(1e10).optional(),
    estimatedCalories: z.number().int().nonnegative().max(20_000).optional(),
    note: z.string().max(2000).optional(),
    /** When true and estimatedCost > 0, also create an Expense in category "Ăn uống". */
    alsoCreateExpense: z.boolean().optional(),
    walletId: z.string().uuid().optional(),
  })
  .strict();
export type QuickMealLogInput = z.infer<typeof QuickMealLogSchema>;

export const QuickSleepLogSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    sleepTime: z.string().datetime(),
    wakeTime: z.string().datetime(),
    quality: z.enum(['VERY_GOOD', 'GOOD', 'NORMAL', 'POOR', 'BAD']).optional(),
    note: z.string().max(1000).optional(),
  })
  .strict();
export type QuickSleepLogInput = z.infer<typeof QuickSleepLogSchema>;

export const QuickMoodLogSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    mood: z.enum(['HAPPY', 'NORMAL', 'STRESSED', 'TIRED', 'SAD', 'MOTIVATED']),
    energyLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    stressLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    note: z.string().max(1000).optional(),
  })
  .strict();
export type QuickMoodLogInput = z.infer<typeof QuickMoodLogSchema>;

// ---- Health integration --------------------------------------------------

export const HEALTH_INTEGRATION_PROVIDERS = ['NONE', 'HEALTHKIT', 'HEALTH_CONNECT'] as const;
export const HealthIntegrationProviderSchema = z.enum(HEALTH_INTEGRATION_PROVIDERS);
export type HealthIntegrationProviderDto = z.infer<typeof HealthIntegrationProviderSchema>;

export const UpdateHealthIntegrationSchema = z
  .object({
    provider: HealthIntegrationProviderSchema.optional(),
    readSleep: z.boolean().optional(),
    readSteps: z.boolean().optional(),
    readExercise: z.boolean().optional(),
    readHeartRate: z.boolean().optional(),
    readWeight: z.boolean().optional(),
  })
  .strict();
export type UpdateHealthIntegrationInput = z.infer<typeof UpdateHealthIntegrationSchema>;

export interface HealthIntegrationDto {
  provider: HealthIntegrationProviderDto;
  readSleep: boolean;
  readSteps: boolean;
  readExercise: boolean;
  readHeartRate: boolean;
  readWeight: boolean;
  lastSyncedAt: string | null;
  /** Always false for v1.2 — native HealthKit / Health Connect lands in v1.3. */
  nativeAvailable: boolean;
  updatedAt: string;
}

// ---- Speech-to-text (provider abstraction) -------------------------------

export const TranscribeRequestSchema = z
  .object({
    /** Base64-encoded audio. Backend caps at ~1MB. v1.2 mock returns 501 unless
     *  STT provider env is configured. */
    audioBase64: z.string().min(1).max(2_000_000),
    /** Audio mime/format hint — `audio/m4a`, `audio/wav`, `audio/webm`, etc. */
    mimeType: z.string().min(1).max(60),
    locale: z.enum(['vi', 'en']).optional(),
  })
  .strict();
export type TranscribeRequestInput = z.infer<typeof TranscribeRequestSchema>;

export interface TranscribeResultDto {
  transcript: string;
  locale: 'vi' | 'en';
  /** True when the backend has no STT provider wired. */
  notImplemented?: boolean;
}
