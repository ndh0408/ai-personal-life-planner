/**
 * SSE client for /assistant/messages/stream (round 26).
 *
 * The API endpoint accepts ?token= because EventSource on web can't set
 * Authorization headers; react-native-sse can, so we use the header form
 * here for parity with the rest of the apiClient.
 *
 * Lifecycle:
 *   1. open(): POST /assistant/messages/stream-open to persist the user
 *      message and mint an assistantMessageId.
 *   2. listen(): wires an EventSource for the named events; the consumer
 *      gets typed callbacks.
 *   3. abort(): closes the EventSource cleanly. Always called from the
 *      hook's cleanup path so a screen unmount doesn't leak a connection.
 *
 * Reconnection: react-native-sse retries automatically on transient errors,
 * but we don't want it retrying *after* the conversation succeeded. The
 * `completed` and `error` event handlers both call abort() to stop the
 * library from re-opening.
 */
import EventSource from 'react-native-sse';
import type { AssistantStreamEvent } from '@lifeos/shared';
import { API_BASE_URL } from './config';
import { apiClient } from './client';

// react-native-sse types its EventSource generically over the set of custom
// event names; the default is `never` which only allows the built-in
// 'message' / 'error' / 'open' events. We declare ours up front so
// addEventListener() accepts the typed names.
type SseEventName =
  | 'assistant.stream.started'
  | 'assistant.stream.progress'
  | 'assistant.stream.delta'
  | 'assistant.stream.suggested_actions'
  | 'assistant.stream.completed'
  | 'assistant.stream.error';

export interface StreamOpenResult {
  conversationId: string;
  threadId: string;
  userMessageId: string;
  assistantMessageId: string;
}

export interface StreamHandlers {
  onProgress?: (label: string, stage: string) => void;
  onDelta?: (delta: string) => void;
  onCompleted?: (finalText: string) => void;
  onError?: (code: string, message: string) => void;
  onSuggestedActions?: (actions: { id: string; label: string }[]) => void;
}

export interface StreamHandle {
  abort: () => void;
}

/**
 * Open a streaming conversation turn. Returns when the server has
 * persisted the user message; `listen()` then attaches to the SSE feed.
 */
export async function openAssistantStream(
  content: string,
  conversationId?: string,
): Promise<StreamOpenResult> {
  return apiClient.request<StreamOpenResult>(
    'POST',
    '/assistant/messages/stream-open',
    { content, conversationId },
  );
}

/** Subscribe to the SSE feed for a previously-opened turn. */
export function listenAssistantStream(
  args: {
    threadId: string;
    messageId: string;
    userText: string;
  },
  handlers: StreamHandlers,
): StreamHandle {
  const tokens = apiClient.getTokens();
  if (!tokens?.accessToken) {
    handlers.onError?.('UNAUTHENTICATED', 'No access token');
    return { abort: () => undefined };
  }

  // EventSource path. Token is in the query because some Hermes/RN HTTP
  // stacks strip Authorization headers on long-lived connections; ?token=
  // is a documented escape hatch for SSE.
  const params = new URLSearchParams({
    token: tokens.accessToken,
    threadId: args.threadId,
    messageId: args.messageId,
    userText: args.userText,
  });
  const url = `${API_BASE_URL}/assistant/messages/stream?${params.toString()}`;

  const es = new EventSource<SseEventName>(url);

  const dispatch = (raw: string) => {
    try {
      const ev = JSON.parse(raw) as AssistantStreamEvent;
      switch (ev.type) {
        case 'assistant.stream.progress':
          handlers.onProgress?.(ev.label, ev.stage);
          break;
        case 'assistant.stream.delta':
          handlers.onDelta?.(ev.delta);
          break;
        case 'assistant.stream.suggested_actions':
          handlers.onSuggestedActions?.(ev.actions);
          break;
        case 'assistant.stream.completed':
          handlers.onCompleted?.(ev.finalText);
          es.close();
          break;
        case 'assistant.stream.error':
          handlers.onError?.(ev.code, ev.message);
          es.close();
          break;
        default:
          // started/etc — no-op; nothing for the UI to do.
          break;
      }
    } catch {
      /* malformed — ignore */
    }
  };

  // The library emits a generic 'message' event for unnamed data lines and
  // typed events for named ones. Our server tags with `type`, so listen
  // for each type explicitly. We register a wildcard `message` too, for
  // safety against future event-name renames.
  const NAMED: SseEventName[] = [
    'assistant.stream.started',
    'assistant.stream.progress',
    'assistant.stream.delta',
    'assistant.stream.suggested_actions',
    'assistant.stream.completed',
    'assistant.stream.error',
  ];
  for (const t of NAMED) {
    es.addEventListener(t, (e) => {
      if (typeof e.data === 'string') dispatch(e.data);
    });
  }
  es.addEventListener('message', (e) => {
    if (typeof e.data === 'string') dispatch(e.data);
  });
  es.addEventListener('error', () => {
    // The library will retry on its own; surface the error once but don't
    // close, so a transient flake doesn't kill an in-progress turn.
    handlers.onError?.('STREAM_ERROR', 'Mất kết nối tạm thời');
  });

  return {
    abort: () => {
      es.removeAllEventListeners();
      es.close();
    },
  };
}
