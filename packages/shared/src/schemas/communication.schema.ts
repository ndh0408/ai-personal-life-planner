import { z } from 'zod';

// ---- Communication settings -----------------------------------------------

export const UpdateCommunicationSettingsSchema = z
  .object({
    emailAssistantEnabled: z.boolean().optional(),
    emailMetadataSync: z.boolean().optional(),
    emailSnippetSync: z.boolean().optional(),
    emailFullContentAnalysis: z.boolean().optional(),
    followUpRemindersEnabled: z.boolean().optional(),
    messageReminderEnabled: z.boolean().optional(),
    androidNotificationImportEnabled: z.boolean().optional(),
    aiMemoryEnabled: z.boolean().optional(),
  })
  .strict();
export type UpdateCommunicationSettingsInput = z.infer<
  typeof UpdateCommunicationSettingsSchema
>;

export interface CommunicationSettingsDto {
  emailAssistantEnabled: boolean;
  emailMetadataSync: boolean;
  emailSnippetSync: boolean;
  emailFullContentAnalysis: boolean;
  followUpRemindersEnabled: boolean;
  messageReminderEnabled: boolean;
  androidNotificationImportEnabled: boolean;
  aiMemoryEnabled: boolean;
  updatedAt: string;
}

// ---- Connected accounts ---------------------------------------------------

export const CONNECTED_ACCOUNT_PROVIDERS = ['GMAIL', 'OUTLOOK', 'IMAP'] as const;
export const ConnectedAccountProviderSchema = z.enum(CONNECTED_ACCOUNT_PROVIDERS);
export type ConnectedAccountProviderDto = z.infer<typeof ConnectedAccountProviderSchema>;

export interface ConnectedAccountDto {
  id: string;
  provider: ConnectedAccountProviderDto;
  email: string;
  displayName: string | null;
  scopes: string[];
  isActive: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---- Email items ----------------------------------------------------------

export const EMAIL_CATEGORIES = [
  'PERSONAL',
  'WORK',
  'FINANCE',
  'BILL',
  'EVENT',
  'PROMOTION',
  'OTHER',
] as const;
export const EmailCategorySchema = z.enum(EMAIL_CATEGORIES);
export type EmailCategoryDto = z.infer<typeof EmailCategorySchema>;

export interface EmailItemDto {
  id: string;
  connectedAccountId: string;
  externalId: string;
  threadId: string | null;
  fromName: string | null;
  fromEmail: string | null;
  subject: string;
  /** Only present when emailSnippetSync is on. */
  snippet: string | null;
  receivedAt: string;
  isRead: boolean;
  isImportant: boolean;
  needsReply: boolean;
  hasDeadline: boolean;
  detectedDeadlineAt: string | null;
  category: EmailCategoryDto | null;
  aiSummary: string | null;
  createdAt: string;
  updatedAt: string;
}

export const ListEmailsQuerySchema = z
  .object({
    category: EmailCategorySchema.optional(),
    needsReply: z.coerce.boolean().optional(),
    isImportant: z.coerce.boolean().optional(),
    hasDeadline: z.coerce.boolean().optional(),
    page: z.coerce.number().int().positive().max(500).default(1),
    limit: z.coerce.number().int().positive().max(100).default(25),
  })
  .strict();
export type ListEmailsQuery = z.infer<typeof ListEmailsQuerySchema>;

export const UpdateEmailStatusSchema = z
  .object({
    isRead: z.boolean().optional(),
    isImportant: z.boolean().optional(),
    needsReply: z.boolean().optional(),
  })
  .strict();
export type UpdateEmailStatusInput = z.infer<typeof UpdateEmailStatusSchema>;

export const CreateEmailReminderFromEmailSchema = z
  .object({
    title: z.string().min(1).max(160),
    note: z.string().max(2000).optional(),
    remindAt: z.string().datetime(),
  })
  .strict();
export type CreateEmailReminderFromEmailInput = z.infer<
  typeof CreateEmailReminderFromEmailSchema
>;

// ---- Email reminders ------------------------------------------------------

export const EMAIL_REMINDER_STATUSES = ['PENDING', 'SENT', 'DISMISSED', 'DONE'] as const;
export const EmailReminderStatusSchema = z.enum(EMAIL_REMINDER_STATUSES);
export type EmailReminderStatusDto = z.infer<typeof EmailReminderStatusSchema>;

export const CreateEmailReminderSchema = z
  .object({
    emailItemId: z.string().uuid().nullable().optional(),
    title: z.string().min(1).max(160),
    note: z.string().max(2000).optional(),
    remindAt: z.string().datetime(),
  })
  .strict();
export type CreateEmailReminderInput = z.infer<typeof CreateEmailReminderSchema>;

export const UpdateEmailReminderStatusSchema = z
  .object({ status: EmailReminderStatusSchema })
  .strict();
export type UpdateEmailReminderStatusInput = z.infer<
  typeof UpdateEmailReminderStatusSchema
>;

export interface EmailReminderDto {
  id: string;
  emailItemId: string | null;
  title: string;
  note: string | null;
  remindAt: string;
  status: EmailReminderStatusDto;
  createdAt: string;
  updatedAt: string;
}

// ---- Message reminders ----------------------------------------------------

export const MESSAGE_REMINDER_STATUSES = [
  'PENDING',
  'SENT',
  'DISMISSED',
  'DONE',
] as const;
export const MessageReminderStatusSchema = z.enum(MESSAGE_REMINDER_STATUSES);
export type MessageReminderStatusDto = z.infer<typeof MessageReminderStatusSchema>;

export const MESSAGE_REMINDER_SOURCES = [
  'MANUAL',
  'AI_SUGGESTED',
  'NOTIFICATION_IMPORT',
] as const;
export const MessageReminderSourceSchema = z.enum(MESSAGE_REMINDER_SOURCES);
export type MessageReminderSourceDto = z.infer<typeof MessageReminderSourceSchema>;

export const CreateMessageReminderSchema = z
  .object({
    contactName: z.string().max(120).optional(),
    platform: z.string().max(60).optional(),
    title: z.string().min(1).max(160),
    note: z.string().max(2000).optional(),
    remindAt: z.string().datetime(),
    source: MessageReminderSourceSchema.optional(),
  })
  .strict();
export type CreateMessageReminderInput = z.infer<typeof CreateMessageReminderSchema>;

export const UpdateMessageReminderStatusSchema = z
  .object({ status: MessageReminderStatusSchema })
  .strict();
export type UpdateMessageReminderStatusInput = z.infer<
  typeof UpdateMessageReminderStatusSchema
>;

export interface MessageReminderDto {
  id: string;
  contactName: string | null;
  platform: string | null;
  title: string;
  note: string | null;
  remindAt: string;
  status: MessageReminderStatusDto;
  source: MessageReminderSourceDto;
  createdAt: string;
  updatedAt: string;
}

// ---- AI Companion memory --------------------------------------------------

export const AI_COMPANION_MEMORY_TYPES = [
  'PREFERENCE',
  'HABIT',
  'GOAL',
  'RELATIONSHIP',
  'WORK_STYLE',
  'COMMUNICATION',
  'HEALTH_CONTEXT',
  'FINANCE_CONTEXT',
  'OTHER',
] as const;
export const AiCompanionMemoryTypeSchema = z.enum(AI_COMPANION_MEMORY_TYPES);
export type AiCompanionMemoryTypeDto = z.infer<typeof AiCompanionMemoryTypeSchema>;

export const AI_COMPANION_MEMORY_SOURCES = [
  'CHAT',
  'VOICE_NOTE',
  'EMAIL',
  'MANUAL_CHECKIN',
  'USER_CONFIRMATION',
] as const;
export const AiCompanionMemorySourceSchema = z.enum(AI_COMPANION_MEMORY_SOURCES);
export type AiCompanionMemorySourceDto = z.infer<typeof AiCompanionMemorySourceSchema>;

export const CreateAiCompanionMemorySchema = z
  .object({
    memoryType: AiCompanionMemoryTypeSchema,
    content: z.string().min(1).max(600),
    source: AiCompanionMemorySourceSchema,
    confidence: z.number().min(0).max(1).optional(),
  })
  .strict();
export type CreateAiCompanionMemoryInput = z.infer<
  typeof CreateAiCompanionMemorySchema
>;

export const UpdateAiCompanionMemorySchema = z
  .object({
    content: z.string().min(1).max(600).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
export type UpdateAiCompanionMemoryInput = z.infer<
  typeof UpdateAiCompanionMemorySchema
>;

export interface AiCompanionMemoryDto {
  id: string;
  memoryType: AiCompanionMemoryTypeDto;
  content: string;
  source: AiCompanionMemorySourceDto;
  confidence: number | null;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const UpdateMemoryConsentSchema = z
  .object({
    allowMemory: z.boolean().optional(),
    allowEmailForAI: z.boolean().optional(),
    allowCommunicationContextForAI: z.boolean().optional(),
    allowVoiceNotesForAI: z.boolean().optional(),
  })
  .strict();
export type UpdateMemoryConsentInput = z.infer<typeof UpdateMemoryConsentSchema>;

export interface MemoryConsentDto {
  allowMemory: boolean;
  allowEmailForAI: boolean;
  allowCommunicationContextForAI: boolean;
  allowVoiceNotesForAI: boolean;
}

// ---- Email AI analysis output ---------------------------------------------

export interface EmailAnalysisDto {
  isImportant: boolean;
  needsReply: boolean;
  hasDeadline: boolean;
  detectedDeadlineAt: string | null;
  category: EmailCategoryDto | null;
  summary: string;
  suggestedReminder: { title: string; remindAt: string } | null;
  /** True when the AI fell back to a deterministic safe response. */
  usedFallback: boolean;
  /** True when the user has the matching domain off and we returned without calling AI. */
  disabledByPrivacy?: boolean;
}
