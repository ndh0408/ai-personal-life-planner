import { api } from './client';
import type {
  AiCompanionMemoryDto,
  AiCompanionMemoryTypeDto,
  CommunicationSettingsDto,
  ConnectedAccountDto,
  CreateAiCompanionMemoryInput,
  CreateEmailReminderFromEmailInput,
  CreateEmailReminderInput,
  CreateMessageReminderInput,
  EmailAnalysisDto,
  EmailItemDto,
  EmailReminderDto,
  EmailReminderStatusDto,
  ListEmailsQuery,
  MemoryConsentDto,
  MessageReminderDto,
  MessageReminderStatusDto,
  UpdateAiCompanionMemoryInput,
  UpdateCommunicationSettingsInput,
  UpdateEmailStatusInput,
  UpdateMemoryConsentInput,
} from '@planner/shared';

export const communicationApi = {
  // settings
  getSettings: () =>
    api.get<CommunicationSettingsDto>('/communication/settings'),
  updateSettings: (input: UpdateCommunicationSettingsInput) =>
    api.put<CommunicationSettingsDto>('/communication/settings', input),

  // connected accounts
  listAccounts: () => api.get<ConnectedAccountDto[]>('/connected-accounts'),
  startGmailOAuth: () =>
    api.post<{ authorizeUrl: string; state: string }>('/connected-accounts/gmail/start'),
  startOutlookOAuth: () =>
    api.post<{ authorizeUrl: string; state: string }>('/connected-accounts/outlook/start'),
  disconnect: (id: string) => api.delete<void>(`/connected-accounts/${id}`),

  // emails
  listEmails: (q: Partial<ListEmailsQuery>) => {
    const search = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => {
      if (v !== undefined && v !== null) search.set(k, String(v));
    });
    const qs = search.toString();
    return api.get<{ items: EmailItemDto[]; total: number; page: number; limit: number }>(
      `/emails${qs ? `?${qs}` : ''}`,
    );
  },
  getEmail: (id: string) => api.get<EmailItemDto>(`/emails/${id}`),
  syncEmails: () =>
    api.post<{ accountsSynced: number; notImplemented: boolean }>('/emails/sync'),
  analyzeEmail: (id: string) =>
    api.post<EmailAnalysisDto>(`/emails/${id}/analyze`),
  patchEmailStatus: (id: string, body: UpdateEmailStatusInput) =>
    api.patch<EmailItemDto>(`/emails/${id}/status`, body),
  createReminderFromEmail: (id: string, body: CreateEmailReminderFromEmailInput) =>
    api.post<EmailReminderDto>(`/emails/${id}/create-reminder`, body),

  // email reminders
  listEmailReminders: () => api.get<EmailReminderDto[]>('/email-reminders'),
  createEmailReminder: (input: CreateEmailReminderInput) =>
    api.post<EmailReminderDto>('/email-reminders', input),
  patchEmailReminderStatus: (id: string, status: EmailReminderStatusDto) =>
    api.patch<EmailReminderDto>(`/email-reminders/${id}/status`, { status }),
  deleteEmailReminder: (id: string) => api.delete<void>(`/email-reminders/${id}`),

  // message reminders
  listMessageReminders: () => api.get<MessageReminderDto[]>('/message-reminders'),
  createMessageReminder: (input: CreateMessageReminderInput) =>
    api.post<MessageReminderDto>('/message-reminders', input),
  patchMessageReminderStatus: (id: string, status: MessageReminderStatusDto) =>
    api.patch<MessageReminderDto>(`/message-reminders/${id}/status`, { status }),
  deleteMessageReminder: (id: string) => api.delete<void>(`/message-reminders/${id}`),

  // AI memory
  listMemory: () => api.get<AiCompanionMemoryDto[]>('/ai-memory'),
  createMemory: (input: CreateAiCompanionMemoryInput) =>
    api.post<AiCompanionMemoryDto>('/ai-memory', input),
  updateMemory: (id: string, input: UpdateAiCompanionMemoryInput) =>
    api.patch<AiCompanionMemoryDto>(`/ai-memory/${id}`, input),
  deleteMemory: (id: string) => api.delete<void>(`/ai-memory/${id}`),
  clearAllMemory: () => api.post<{ cleared: number }>('/ai-memory/clear'),
  getMemoryConsent: () => api.get<MemoryConsentDto>('/ai-memory/consent'),
  updateMemoryConsent: (input: UpdateMemoryConsentInput) =>
    api.put<MemoryConsentDto>('/ai-memory/consent', input),
};

export const COMPANION_MEMORY_TYPES: AiCompanionMemoryTypeDto[] = [
  'PREFERENCE',
  'HABIT',
  'GOAL',
  'RELATIONSHIP',
  'WORK_STYLE',
  'COMMUNICATION',
  'HEALTH_CONTEXT',
  'FINANCE_CONTEXT',
  'OTHER',
];
