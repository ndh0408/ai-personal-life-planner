import { z } from 'zod';

// User submits the raw key once; the wire format only ever travels client→server.
// Server encrypts at rest (AES-256-GCM) and never echoes it back.
export const SetOpenAiKeyRequestSchema = z.object({
  apiKey: z
    .string()
    .min(20, 'API key looks too short')
    .max(200, 'API key looks too long')
    .regex(/^sk-/, 'OpenAI keys start with sk-'),
});
export type SetOpenAiKeyRequest = z.infer<typeof SetOpenAiKeyRequestSchema>;

export const AiCredentialStatusSchema = z.object({
  hasKey: z.boolean(),
  provider: z.literal('openai'),
  lastTestedAt: z.string().nullable(),
  lastTestOk: z.boolean().nullable(),
});
export type AiCredentialStatus = z.infer<typeof AiCredentialStatusSchema>;

export const TestKeyResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string().optional(),
});
export type TestKeyResponse = z.infer<typeof TestKeyResponseSchema>;
