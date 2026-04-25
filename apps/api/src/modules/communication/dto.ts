import type {
  AICompanionMemory,
  CommunicationSetting,
  ConnectedAccount,
  EmailItem,
  EmailReminder,
  MemoryConsent,
  MessageReminder,
} from '@prisma/client';
import type {
  AiCompanionMemoryDto,
  CommunicationSettingsDto,
  ConnectedAccountDto,
  EmailItemDto,
  EmailReminderDto,
  MemoryConsentDto,
  MessageReminderDto,
} from '@planner/shared';

export function toCommunicationSettingsDto(
  row: CommunicationSetting,
): CommunicationSettingsDto {
  return {
    emailAssistantEnabled: row.emailAssistantEnabled,
    emailMetadataSync: row.emailMetadataSync,
    emailSnippetSync: row.emailSnippetSync,
    emailFullContentAnalysis: row.emailFullContentAnalysis,
    followUpRemindersEnabled: row.followUpRemindersEnabled,
    messageReminderEnabled: row.messageReminderEnabled,
    androidNotificationImportEnabled: row.androidNotificationImportEnabled,
    aiMemoryEnabled: row.aiMemoryEnabled,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toMemoryConsentDto(row: MemoryConsent): MemoryConsentDto {
  return {
    allowMemory: row.allowMemory,
    allowEmailForAI: row.allowEmailForAI,
    allowCommunicationContextForAI: row.allowCommunicationContextForAI,
    allowVoiceNotesForAI: row.allowVoiceNotesForAI,
  };
}

/**
 * Strips encrypted tokens before crossing the API boundary. Even masked
 * representations are intentionally NOT exposed — the client only needs
 * email/provider/scopes/lastSyncedAt to render the connection UI.
 */
export function toConnectedAccountDto(row: ConnectedAccount): ConnectedAccountDto {
  return {
    id: row.id,
    provider: row.provider,
    email: row.email,
    displayName: row.displayName,
    scopes: Array.isArray(row.scopes) ? (row.scopes as string[]) : [],
    isActive: row.isActive,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toEmailItemDto(row: EmailItem): EmailItemDto {
  return {
    id: row.id,
    connectedAccountId: row.connectedAccountId,
    externalId: row.externalId,
    threadId: row.threadId,
    fromName: row.fromName,
    fromEmail: row.fromEmail,
    subject: row.subject,
    snippet: row.snippet,
    receivedAt: row.receivedAt.toISOString(),
    isRead: row.isRead,
    isImportant: row.isImportant,
    needsReply: row.needsReply,
    hasDeadline: row.hasDeadline,
    detectedDeadlineAt: row.detectedDeadlineAt?.toISOString() ?? null,
    category: row.category,
    aiSummary: row.aiSummary,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toEmailReminderDto(row: EmailReminder): EmailReminderDto {
  return {
    id: row.id,
    emailItemId: row.emailItemId,
    title: row.title,
    note: row.note,
    remindAt: row.remindAt.toISOString(),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toMessageReminderDto(row: MessageReminder): MessageReminderDto {
  return {
    id: row.id,
    contactName: row.contactName,
    platform: row.platform,
    title: row.title,
    note: row.note,
    remindAt: row.remindAt.toISOString(),
    status: row.status,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toCompanionMemoryDto(row: AICompanionMemory): AiCompanionMemoryDto {
  return {
    id: row.id,
    memoryType: row.memoryType,
    content: row.content,
    source: row.source,
    confidence: row.confidence,
    isActive: row.isActive,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
