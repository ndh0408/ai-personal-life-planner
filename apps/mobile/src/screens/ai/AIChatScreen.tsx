import React, { useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Button } from '../../components/ui';
import { aiApi } from '../../services/api/ai.api';
import { useAiGate } from '../../hooks/useAiEnabled';
import { useErrorMessage } from '../../i18n/useErrorMessage';

type Bubble = { id: string; role: 'user' | 'assistant'; text: string };

export function AIChatScreen() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const messageFor = useErrorMessage();
  const [bubbles, setBubbles] = useState<Bubble[]>([
    { id: 'hi', role: 'assistant', text: t('aiChat.greeting') },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const conversationRef = useRef<string | undefined>(undefined);
  const listRef = useRef<FlatList<Bubble>>(null);
  const guardAi = useAiGate();

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    if (!guardAi()) return;
    setInput('');
    const userBubble: Bubble = { id: `u-${Date.now()}`, role: 'user', text };
    setBubbles((b) => [...b, userBubble]);
    setSending(true);
    try {
      const res = await aiApi.chat({ message: text, conversationId: conversationRef.current });
      conversationRef.current = res.conversationId;
      const assistant: Bubble = { id: `a-${Date.now()}`, role: 'assistant', text: res.reply.answer };
      setBubbles((b) => [...b, assistant]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (e) {
      Alert.alert(t('aiChat.failTitle'), messageFor(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={80}
      >
        <FlatList
          ref={listRef}
          data={bubbles}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.lg }}
          renderItem={({ item }) => (
            <View
              style={{
                alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: item.role === 'user' ? colors.primary : colors.surface,
                borderRadius: radius.lg,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm + 2,
                marginBottom: spacing.sm,
                maxWidth: '85%',
                borderWidth: item.role === 'user' ? 0 : 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: item.role === 'user' ? '#FFFFFF' : colors.text, fontSize: 15 }}>
                {item.text}
              </Text>
            </View>
          )}
        />
        <View
          style={{
            padding: spacing.md,
            flexDirection: 'row',
            gap: spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.bgElevated,
          }}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={t('aiChat.placeholder')}
            placeholderTextColor={colors.textMuted}
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              paddingVertical: 10,
              color: colors.text,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          />
          <Button title={t('common.send')} loading={sending} onPress={send} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
