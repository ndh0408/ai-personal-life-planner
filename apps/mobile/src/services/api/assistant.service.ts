import { apiClient } from './client';

export type AiMessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM';

export interface AiMessage {
  id: string;
  conversationId: string;
  role: AiMessageRole;
  content: string;
  createdAt: string;
}

export interface AiConversation {
  id: string;
  title: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SendMessageResponse {
  conversationId: string;
  userMessage: AiMessage;
  assistantMessage: AiMessage;
}

export interface ConversationDetail {
  conversation: AiConversation;
  messages: AiMessage[];
}

export const assistantService = {
  send(content: string, conversationId?: string) {
    return apiClient.request<SendMessageResponse>(
      'POST',
      '/assistant/messages',
      { content, conversationId },
      { timeoutMs: 45_000 },
    );
  },
  list() {
    return apiClient.request<AiConversation[]>('GET', '/assistant/conversations');
  },
  detail(id: string) {
    return apiClient.request<ConversationDetail>('GET', `/assistant/conversations/${id}`);
  },
  remove(id: string) {
    return apiClient.request<void>('DELETE', `/assistant/conversations/${id}`);
  },
};
