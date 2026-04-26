import { z } from 'zod';

export const USER_AI_PROVIDER_TYPES = [
  'NVIDIA',
  'OPENAI',
  'GEMINI',
  'ANTHROPIC',
  'OPENROUTER',
  'CUSTOM_OPENAI_COMPATIBLE',
] as const;

export const UserAiProviderTypeSchema = z.enum(USER_AI_PROVIDER_TYPES);
export type UserAiProviderTypeDto = z.infer<typeof UserAiProviderTypeSchema>;

const ModelSchema = z.string().min(1).max(120).optional();

export const CreateUserAiProviderSchema = z
  .object({
    provider: UserAiProviderTypeSchema,
    name: z.string().min(1).max(80),
    baseUrl: z.string().url().optional(),
    apiKey: z.string().min(8).max(512),
    defaultChatModel: ModelSchema,
    defaultPlannerModel: ModelSchema,
    defaultFinanceModel: ModelSchema,
    defaultMealModel: ModelSchema,
    defaultHealthModel: ModelSchema,
    defaultReportModel: ModelSchema,
    isDefault: z.boolean().optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.provider === 'CUSTOM_OPENAI_COMPATIBLE' && !v.baseUrl) {
      ctx.addIssue({
        code: 'custom',
        path: ['baseUrl'],
        message: 'baseUrl is required for CUSTOM_OPENAI_COMPATIBLE',
      });
    }
  });

export type CreateUserAiProviderInput = z.infer<typeof CreateUserAiProviderSchema>;

export const UpdateUserAiProviderSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    baseUrl: z.string().url().nullable().optional(),
    apiKey: z.string().min(8).max(512).optional(),
    defaultChatModel: ModelSchema.or(z.null()),
    defaultPlannerModel: ModelSchema.or(z.null()),
    defaultFinanceModel: ModelSchema.or(z.null()),
    defaultMealModel: ModelSchema.or(z.null()),
    defaultHealthModel: ModelSchema.or(z.null()),
    defaultReportModel: ModelSchema.or(z.null()),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
  })
  .strict()
  .partial();

export type UpdateUserAiProviderInput = z.infer<typeof UpdateUserAiProviderSchema>;

export const UpdateUserAiPreferenceSchema = z
  .object({
    useOwnApiKey: z.boolean().optional(),
    fallbackToGlobalProvider: z.boolean().optional(),
    defaultProviderId: z.string().uuid().nullable().optional(),
  })
  .strict();

export type UpdateUserAiPreferenceInput = z.infer<typeof UpdateUserAiPreferenceSchema>;

/**
 * Consumer-grade fast path: paste an OpenAI key, get a working provider.
 *
 * Backend fills name/baseUrl/default model from server config, sets
 * `provider=OPENAI` + `isDefault=true` + `isActive=true`, and (when this
 * is the user's first provider) flips `useOwnApiKey=true` so the AI
 * features unlock immediately. Used by the mobile `AISetupScreen` (Round
 * 20.5). Does NOT replace the full schema — power users can still hit
 * `POST /user-ai-providers` directly.
 */
export const QuickOpenAiSetupSchema = z
  .object({
    apiKey: z.string().min(8).max(512),
  })
  .strict();

export type QuickOpenAiSetupInput = z.infer<typeof QuickOpenAiSetupSchema>;

export interface UserAiProviderDto {
  id: string;
  provider: UserAiProviderTypeDto;
  name: string;
  baseUrl: string | null;
  apiKeyLast4: string;
  maskedApiKey: string;
  defaultChatModel: string | null;
  defaultPlannerModel: string | null;
  defaultFinanceModel: string | null;
  defaultMealModel: string | null;
  defaultHealthModel: string | null;
  defaultReportModel: string | null;
  isActive: boolean;
  isDefault: boolean;
  lastTestedAt: string | null;
  lastTestStatus: 'SUCCESS' | 'FAILED' | null;
  lastTestError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserAiPreferenceDto {
  useOwnApiKey: boolean;
  fallbackToGlobalProvider: boolean;
  defaultProviderId: string | null;
}

export interface UserAiProviderTestResultDto {
  ok: boolean;
  provider: string;
  model: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  testedAt: string;
}
