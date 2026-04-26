import { z } from 'zod';

export const AiProviderSchema = z.enum(['OPENAI']);
export type AiProvider = z.infer<typeof AiProviderSchema>;

export const AiKeyTestStatusSchema = z.enum(['SUCCESS', 'FAILED']);
export type AiKeyTestStatus = z.infer<typeof AiKeyTestStatusSchema>;

/** Wire schema for POST /api/ai-key/setup-openai */
export const SetupOpenAiKeyRequestSchema = z.object({
  apiKey: z
    .string()
    .min(20, 'API key trông quá ngắn')
    .max(200, 'API key trông quá dài')
    .regex(/^sk-/, 'OpenAI key bắt đầu bằng sk-'),
});
export type SetupOpenAiKeyRequest = z.infer<typeof SetupOpenAiKeyRequestSchema>;

/** GET /api/ai-key/status */
export const AiKeyStatusSchema = z.object({
  enabled: z.boolean(),
  provider: AiProviderSchema.nullable(),
  maskedApiKey: z.string().nullable(),
  lastTestStatus: AiKeyTestStatusSchema.nullable(),
  lastTestedAt: z.string().nullable(),
});
export type AiKeyStatus = z.infer<typeof AiKeyStatusSchema>;

/** POST /api/ai-key/test */
export const TestAiKeyResponseSchema = z.object({
  status: AiKeyTestStatusSchema,
  maskedApiKey: z.string(),
  message: z.string().optional(),
});
export type TestAiKeyResponse = z.infer<typeof TestAiKeyResponseSchema>;

export const AI_KEY_ERROR_CODES = [
  'AI_KEY_INVALID_FORMAT',
  'AI_KEY_TEST_FAILED',
  'AI_KEY_NOT_FOUND',
  'AI_KEY_QUOTA_EXCEEDED',
  'AI_PROVIDER_UNREACHABLE',
] as const;
export type AiKeyErrorCode = (typeof AI_KEY_ERROR_CODES)[number];
