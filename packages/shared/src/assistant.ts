import { z } from 'zod';

export const AiMessageRoleSchema = z.enum(['USER', 'ASSISTANT', 'SYSTEM']);
export type AiMessageRole = z.infer<typeof AiMessageRoleSchema>;

export const AiMessagePublicSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: AiMessageRoleSchema,
  content: z.string(),
  createdAt: z.string(),
});
export type AiMessagePublic = z.infer<typeof AiMessagePublicSchema>;

export const AiConversationPublicSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  messageCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AiConversationPublic = z.infer<typeof AiConversationPublicSchema>;

export const SendMessageRequestSchema = z.object({
  conversationId: z.string().min(1).max(40).optional(),
  content: z.string().min(1).max(4000),
});
export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;

export const SendMessageResponseSchema = z.object({
  conversationId: z.string(),
  userMessage: AiMessagePublicSchema,
  assistantMessage: AiMessagePublicSchema,
});
export type SendMessageResponse = z.infer<typeof SendMessageResponseSchema>;

export const ConversationDetailSchema = z.object({
  conversation: AiConversationPublicSchema,
  messages: z.array(AiMessagePublicSchema),
});
export type ConversationDetail = z.infer<typeof ConversationDetailSchema>;

export const ASSISTANT_ERROR_CODES = [
  'ASSISTANT_AI_KEY_MISSING',
  'ASSISTANT_AI_KEY_FAILED',
  'ASSISTANT_RATE_LIMITED',
  'ASSISTANT_QUOTA_EXCEEDED',
  'ASSISTANT_TIMEOUT',
] as const;
export type AssistantErrorCode = (typeof ASSISTANT_ERROR_CODES)[number];

// ── Round 24: streaming event model ─────────────────────────────────────────
//
// Shared event schema for the SSE endpoint (mobile starts on staged-progress
// polling and upgrades to full streams once react-native-sse lands). Events
// carry a monotonic `seq` so a late consumer can reorder them; `completed`
// always carries the final assembled text so a client that missed deltas
// can still render the reply.

export const AssistantStreamStageSchema = z.enum([
  'reading_snapshot',
  'calling_llm',
  'summarising',
]);
export type AssistantStreamStage = z.infer<typeof AssistantStreamStageSchema>;

const StreamBase = z.object({
  type: z.string(),
  threadId: z.string(),
  messageId: z.string(),
  seq: z.number().int().nonnegative(),
});

export const AssistantStreamEventSchema = z.discriminatedUnion('type', [
  StreamBase.extend({
    type: z.literal('assistant.stream.started'),
    snapshotVersion: z.string().optional(),
  }),
  StreamBase.extend({
    type: z.literal('assistant.stream.progress'),
    stage: AssistantStreamStageSchema,
    label: z.string(),
  }),
  StreamBase.extend({
    type: z.literal('assistant.stream.delta'),
    delta: z.string(),
  }),
  StreamBase.extend({
    type: z.literal('assistant.stream.suggested_actions'),
    actions: z.array(z.object({ id: z.string(), label: z.string() })),
  }),
  StreamBase.extend({
    type: z.literal('assistant.stream.completed'),
    finalText: z.string(),
    suggestedActions: z
      .array(z.object({ id: z.string(), label: z.string() }))
      .optional(),
  }),
  StreamBase.extend({
    type: z.literal('assistant.stream.error'),
    code: z.string(),
    message: z.string(),
  }),
]);
export type AssistantStreamEvent = z.infer<typeof AssistantStreamEventSchema>;
