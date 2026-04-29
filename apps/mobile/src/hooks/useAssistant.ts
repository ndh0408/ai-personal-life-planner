import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  assistantService,
  type ConversationDetail,
  type SendMessageResponse,
} from '../services/api/assistant.service';
import {
  listenAssistantStream,
  openAssistantStream,
  type MobileAssistantAction,
  type StreamHandle,
} from '../services/api/assistantStream.client';

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

// ── Streaming hook (round 26) ────────────────────────────────────────────────
//
// Drives the live conversation surface. Owns the SSE handle so a screen
// unmount or a "stop" tap cleanly closes it. The hook never mutates the
// conversation cache while streaming — only on `completed` does it merge
// the assembled assistant message in. This keeps the visible bubble in
// step with the assembled text and avoids "two assistant bubbles" bugs
// caused by an early cache write racing the cache invalidation.

export interface StreamingState {
  isStreaming: boolean;
  stage: string | null;
  liveText: string; // accumulated deltas
  error: { code: string; message: string } | null;
  /** Round 32: action chips emitted by the server before the final delta. */
  actions: MobileAssistantAction[];
}

const INITIAL_STATE: StreamingState = {
  isStreaming: false,
  stage: null,
  liveText: '',
  error: null,
  actions: [],
};

export function useStreamingAssistant() {
  const qc = useQueryClient();
  const [state, setState] = useState<StreamingState>(INITIAL_STATE);
  const handleRef = useRef<StreamHandle | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    handleRef.current?.abort();
    handleRef.current = null;
    setState((s) => ({ ...s, isStreaming: false }));
  }, []);

  // Always tear down on unmount.
  useEffect(() => () => handleRef.current?.abort(), []);

  const send = useCallback(
    async (content: string, conversationId?: string) => {
      // Reset visible state for a fresh turn.
      setState({ isStreaming: true, stage: null, liveText: '', error: null, actions: [] });

      let opened: Awaited<ReturnType<typeof openAssistantStream>>;
      try {
        opened = await openAssistantStream(content, conversationId);
      } catch (e) {
        const err = e as { message?: string };
        setState({
          isStreaming: false,
          stage: null,
          liveText: '',
          error: { code: 'OPEN_FAILED', message: err.message ?? 'Mở stream thất bại' },
          actions: [],
        });
        return null;
      }

      conversationIdRef.current = opened.conversationId;
      // Optimistically insert the user message into the cache so the bubble
      // appears immediately, the same way the non-stream send does.
      qc.setQueryData<ConversationDetail | undefined>(
        ASSISTANT_KEYS.detail(opened.conversationId),
        (prev) =>
          prev
            ? {
                conversation: {
                  ...prev.conversation,
                  messageCount: prev.conversation.messageCount + 1,
                },
                messages: [
                  ...prev.messages,
                  {
                    id: opened.userMessageId,
                    conversationId: opened.conversationId,
                    role: 'USER',
                    content,
                    createdAt: new Date().toISOString(),
                  },
                ],
              }
            : prev,
      );

      handleRef.current = listenAssistantStream(
        {
          threadId: opened.threadId,
          messageId: opened.assistantMessageId,
          userText: content,
        },
        {
          onProgress: (label) => setState((s) => ({ ...s, stage: label })),
          onDelta: (delta) =>
            setState((s) => ({ ...s, liveText: s.liveText + delta, stage: null })),
          // Round 32: stash AssistantAction[] so the chip strip can render
          // alongside the final assistant bubble.
          onActions: (actions) => setState((s) => ({ ...s, actions })),
          onCompleted: (finalText) => {
            // Finalise: append the assistant bubble into the cache.
            qc.setQueryData<ConversationDetail | undefined>(
              ASSISTANT_KEYS.detail(opened.conversationId),
              (prev) =>
                prev
                  ? {
                      conversation: {
                        ...prev.conversation,
                        messageCount: prev.conversation.messageCount + 1,
                      },
                      messages: [
                        ...prev.messages,
                        {
                          id: opened.assistantMessageId,
                          conversationId: opened.conversationId,
                          role: 'ASSISTANT',
                          content: finalText,
                          createdAt: new Date().toISOString(),
                        },
                      ],
                    }
                  : prev,
            );
            qc.invalidateQueries({ queryKey: ASSISTANT_KEYS.list });
            // Keep `actions` so the chip row stays visible until the user
            // sends the next message; everything else resets.
            setState((s) => ({
              isStreaming: false,
              stage: null,
              liveText: '',
              error: null,
              actions: s.actions,
            }));
          },
          onError: (code, message) =>
            setState({
              isStreaming: false,
              stage: null,
              liveText: '',
              error: { code, message },
              actions: [],
            }),
        },
      );

      return opened.conversationId;
    },
    [qc],
  );

  return { ...state, send, stop, conversationId: conversationIdRef.current };
}
