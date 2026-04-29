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
  /** Round 30: suggested follow-up actions; UI surfaces as chips. */
  suggestedActions: z.array(z.unknown()).default([]),
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

// ── Round 30: assistant actions ─────────────────────────────────────────────
//
// After an assistant turn finishes, the model can suggest user-facing
// follow-up actions: "open SmartEntry with this text", "generate today's
// plan", etc. These are SUGGESTIONS — the UI surfaces them as chips and
// only fires the action after a user tap. Per the Microsoft HAI guidelines
// and Google PAIR responsible-agent pattern, never silently create or
// destroy data on the user's behalf without explicit confirmation.

export const AssistantActionTypeSchema = z.enum([
  'OPEN_SMART_ENTRY',
  'GENERATE_TODAY_PLAN',
  'REFRESH_RECOMMENDATIONS',
  'OPEN_SCREEN',
]);
export type AssistantActionType = z.infer<typeof AssistantActionTypeSchema>;

export const AssistantActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('OPEN_SMART_ENTRY'),
    label: z.string().max(80),
    /** Pre-fills the SmartEntry text field. The user still confirms before save. */
    prefillText: z.string().max(500),
    /** Optional kind preselect ('EXPENSE', 'TASK', etc.) */
    mode: z.string().max(20).optional(),
  }),
  z.object({
    type: z.literal('GENERATE_TODAY_PLAN'),
    label: z.string().max(80),
  }),
  z.object({
    type: z.literal('REFRESH_RECOMMENDATIONS'),
    label: z.string().max(80),
  }),
  z.object({
    type: z.literal('OPEN_SCREEN'),
    label: z.string().max(80),
    /** Route name on the mobile RootStack — UI maps this to navigation. */
    screen: z.enum([
      'Today',
      'Money',
      'Tasks',
      'MealLog',
      'SleepMoodCheckin',
      'AISettings',
      'Privacy',
      'Memory',
      'Preferences',
    ]),
  }),
]);
export type AssistantAction = z.infer<typeof AssistantActionSchema>;

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
    /** Legacy id+label pairs (R24). New consumers should use `actions` (R30). */
    actions: z.array(z.object({ id: z.string(), label: z.string() })),
  }),
  StreamBase.extend({
    /** Round 30: structured AssistantAction[] sent after the final delta.
     *  UI maps each entry to a chip whose tap routes to the screen / opens
     *  SmartEntry / triggers a confirmable action. */
    type: z.literal('assistant.stream.actions'),
    actions: z.array(AssistantActionSchema),
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
