import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  AppHeader,
  AppScreen,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  LoadingState,
  Text,
  useToast,
} from '../../components/ui';
import { spacing, colors, radius } from '../../theme';
import {
  useConversation,
  useConversations,
  useDeleteConversation,
  useStreamingAssistant,
} from '../../hooks/useAssistant';
import { ChatBubble } from '../../components/assistant/ChatBubble';
import { ChatComposer } from '../../components/assistant/ChatComposer';
import { readableError } from '../../utils/error';

type ScreenMode = 'list' | 'chat';

export function AssistantScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const [view, setView] = useState<ScreenMode>('list');
  const [activeId, setActiveId] = useState<string | null>(null);

  const list = useConversations();
  const detail = useConversation(activeId);
  const stream = useStreamingAssistant();
  const remove = useDeleteConversation();
  const lastUserTextRef = useRef<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const messagesLength = detail.data?.messages.length ?? 0;

  // Scroll to the bottom on new messages, on stage updates (so the
  // "Đang đọc dữ liệu hôm nay…" pill stays visible), and on every delta
  // batch (so the live text doesn't fall off-screen).
  useEffect(() => {
    if (view === 'chat') {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  }, [view, messagesLength, stream.stage, stream.liveText]);

  // Surface stream errors as toasts. Streaming errors arrive on the SSE
  // channel rather than as a thrown promise, so this is the only path.
  useEffect(() => {
    if (stream.error) {
      const message = stream.error.message
        || readableError(stream.error, t, 'assistant');
      toast.show(message, 'danger');
    }
  }, [stream.error, toast, t]);

  const handleSend = async (content: string) => {
    lastUserTextRef.current = content;
    const cid = await stream.send(content, activeId ?? undefined);
    if (cid && !activeId) setActiveId(cid);
  };

  const handleStop = () => stream.stop();

  const handleRegenerate = () => {
    if (!lastUserTextRef.current || stream.isStreaming) return;
    void stream.send(lastUserTextRef.current, activeId ?? undefined);
  };

  if (view === 'list') {
    return (
      <AppScreen>
        <Text variant="kicker">{t('tabs.assistant')}</Text>
        <Text variant="display" style={{ marginTop: spacing.md, marginBottom: spacing.xl }}>
          {t('assistant.title')}
        </Text>

        <Button
          label={'+  ' + t('assistant.inputPlaceholder')}
          variant="secondary"
          onPress={() => {
            setActiveId(null);
            setView('chat');
          }}
        />

        <View style={{ height: spacing.xl }} />

        {list.isError ? <ErrorState onRetry={() => list.refetch()} /> : null}
        {list.isLoading ? <LoadingState /> : null}
        {list.data && list.data.length === 0 ? <EmptyState title={t('assistant.empty')} /> : null}

        <View style={{ gap: spacing.md }}>
          {list.data?.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => {
                setActiveId(c.id);
                setView('chat');
              }}
            >
              <Card>
                <Text variant="bodyEm" numberOfLines={2}>
                  {c.title ?? '(không có tiêu đề)'}
                </Text>
                <Text variant="caption">
                  {c.messageCount} · {new Date(c.updatedAt).toLocaleString()}
                </Text>
              </Card>
            </Pressable>
          ))}
        </View>
      </AppScreen>
    );
  }

  // ── Chat view ──────────────────────────────────────────────────────────────

  const handleDelete = () => {
    if (!activeId) return;
    remove.mutate(activeId, {
      onSuccess: () => {
        setActiveId(null);
        setView('list');
      },
    });
  };

  return (
    <AppScreen
      noBottomInset
      footer={<ChatComposer busy={stream.isStreaming} onSend={handleSend} />}
      scroll={false}
    >
      <AppHeader
        title={detail.data?.conversation.title ?? t('tabs.assistant')}
        onBack={() => {
          setView('list');
          setActiveId(null);
        }}
        trailing={
          activeId ? (
            <Pressable onPress={handleDelete} style={styles.deleteBtn}>
              <Text variant="caption" style={{ color: colors.status.danger }}>
                {t('common.delete')}
              </Text>
            </Pressable>
          ) : null
        }
      />

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingVertical: spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        {detail.isLoading && activeId ? <LoadingState /> : null}
        {detail.data?.messages.map((m) => (
          <ChatBubble key={m.id} msg={m} />
        ))}
        {!activeId && !stream.isStreaming ? (
          <Text variant="caption">{t('assistant.empty')}</Text>
        ) : null}

        {/* Streaming surface: shows progress label *or* the live token feed,
            never both — the server emits exactly one progress event before
            the first delta lands. */}
        {stream.isStreaming && stream.liveText ? (
          <View style={styles.liveBubble}>
            <Text>{stream.liveText}</Text>
            <StreamControls onStop={handleStop} />
          </View>
        ) : stream.isStreaming ? (
          <View style={styles.thinking}>
            <Text variant="caption">
              {stream.stage ?? t('assistant.stages.calling_llm', { defaultValue: 'Đang suy nghĩ…' })}
            </Text>
            <StreamControls onStop={handleStop} compact />
          </View>
        ) : null}

        {/* Regenerate button when the last turn finished and we have a
            seed prompt to retry. Hidden during active streams. */}
        {!stream.isStreaming && lastUserTextRef.current && !stream.error ? (
          <Pressable
            onPress={handleRegenerate}
            style={[styles.regenerateBtn, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('assistant.regenerate', { defaultValue: 'Hỏi lại' })}
          >
            <Icon name="refresh-outline" size={14} color={colors.accent.base} />
            <Text variant="caption" style={{ color: colors.accent.base }}>
              {t('assistant.regenerate', { defaultValue: 'Hỏi lại' })}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}

function StreamControls({ onStop, compact }: { onStop: () => void; compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onStop}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t('assistant.stop', { defaultValue: 'Dừng' })}
      style={[
        styles.stopBtn,
        { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36 },
        compact ? { paddingHorizontal: spacing.sm, marginTop: 4 } : { marginTop: spacing.xs },
      ]}
    >
      <Icon name="stop-outline" size={14} color={colors.status.danger} />
      <Text variant="caption" style={{ color: colors.status.danger, fontWeight: '700' }}>
        {t('assistant.stop', { defaultValue: 'Dừng' })}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  deleteBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(201, 98, 74, 0.16)',
  },
  thinking: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    alignSelf: 'flex-start',
    marginVertical: spacing.xs,
  },
  liveBubble: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.accent.soft,
    borderColor: colors.accent.base,
    borderWidth: 1,
    borderRadius: radius.lg,
    alignSelf: 'flex-start',
    marginVertical: spacing.xs,
    maxWidth: '90%',
  },
  stopBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(201, 98, 74, 0.12)',
    alignSelf: 'flex-start',
  },
  regenerateBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginTop: spacing.sm,
    marginLeft: spacing.lg,
  },
});
