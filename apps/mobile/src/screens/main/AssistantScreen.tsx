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
  LoadingState,
  Text,
  useToast,
} from '../../components/ui';
import { spacing, colors, radius } from '../../theme';
import {
  useConversation,
  useConversations,
  useDeleteConversation,
  useSendMessage,
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
  const send = useSendMessage();
  const remove = useDeleteConversation();

  const scrollRef = useRef<ScrollView>(null);
  const messagesLength = detail.data?.messages.length ?? 0;

  useEffect(() => {
    if (view === 'chat' && messagesLength > 0) {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  }, [view, messagesLength]);

  const handleSend = (content: string) => {
    send.mutate(
      { content, conversationId: activeId ?? undefined },
      {
        onSuccess: (data) => {
          if (!activeId) setActiveId(data.conversationId);
        },
        onError: (e) => {
          toast.show(readableError(e, t, 'assistant'), 'danger');
        },
      },
    );
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
      footer={<ChatComposer busy={send.isPending} onSend={handleSend} />}
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
        {!activeId ? <Text variant="caption">{t('assistant.empty')}</Text> : null}
        {send.isPending ? (
          <View style={styles.thinking}>
            <Text variant="caption">…</Text>
          </View>
        ) : null}
      </ScrollView>
    </AppScreen>
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
  },
});
