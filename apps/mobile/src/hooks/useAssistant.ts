import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  assistantService,
  type ConversationDetail,
  type SendMessageResponse,
} from '../services/api/assistant.service';

export const ASSISTANT_KEYS = {
  list: ['assistant', 'conversations'] as const,
  detail: (id: string) => ['assistant', 'conversation', id] as const,
};

export function useConversations() {
  return useQuery({ queryKey: ASSISTANT_KEYS.list, queryFn: () => assistantService.list() });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: id ? ASSISTANT_KEYS.detail(id) : ['assistant', 'conversation', 'none'],
    queryFn: () => assistantService.detail(id!),
    enabled: !!id,
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation<SendMessageResponse, unknown, { content: string; conversationId?: string }>({
    mutationFn: ({ content, conversationId }) => assistantService.send(content, conversationId),
    onSuccess: (data) => {
      // Refresh list ordering (updatedAt bumped) and the active conversation.
      qc.invalidateQueries({ queryKey: ASSISTANT_KEYS.list });
      qc.invalidateQueries({ queryKey: ASSISTANT_KEYS.detail(data.conversationId) });
      // Optimistic detail update so the new pair appears immediately, before refetch.
      qc.setQueryData<ConversationDetail | undefined>(
        ASSISTANT_KEYS.detail(data.conversationId),
        (prev) =>
          prev
            ? {
                conversation: { ...prev.conversation, messageCount: prev.conversation.messageCount + 2 },
                messages: [...prev.messages, data.userMessage, data.assistantMessage],
              }
            : undefined,
      );
    },
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (id: string) => assistantService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ASSISTANT_KEYS.list }),
  });
}
