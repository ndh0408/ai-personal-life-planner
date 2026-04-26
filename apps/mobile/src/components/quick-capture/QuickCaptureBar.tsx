import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, spacing, typography } from '../../theme';

interface Props {
  busy?: boolean;
  onSend: (text: string) => void;
}

/**
 * Sticky bottom composer. Multi-line up to ~3 lines, auto-grows. The send
 * button is enabled only when the trimmed text is ≥ 2 chars (prevents accidental
 * sends from a stray space).
 */
export function QuickCaptureBar({ busy = false, onSend }: Props) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const trimmed = text.trim();
  const canSend = trimmed.length >= 2 && !busy;

  const submit = () => {
    if (!canSend) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <View style={styles.row}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder={t('home.quickCapturePlaceholder')}
        placeholderTextColor={colors.text.muted}
        multiline
        maxLength={500}
        returnKeyType="send"
        blurOnSubmit
        onSubmitEditing={submit}
        autoCorrect={false}
      />
      <Pressable
        onPress={submit}
        disabled={!canSend}
        style={({ pressed }) => [
          styles.send,
          !canSend && styles.sendDisabled,
          pressed && canSend && styles.sendPressed,
        ]}
        hitSlop={6}
      >
        {busy ? (
          <ActivityIndicator color={colors.text.inverse} size="small" />
        ) : (
          <Text style={styles.sendLabel}>{t('capture.send')}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  input: {
    flex: 1,
    color: colors.text.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: 40,
    maxHeight: 120,
    ...typography.body,
  },
  send: {
    backgroundColor: colors.accent.base,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendPressed: { backgroundColor: colors.accent.pressed, transform: [{ scale: 0.97 }] },
  sendDisabled: { opacity: 0.4 },
  sendLabel: { ...typography.bodyEm, color: colors.text.inverse, fontWeight: '700' },
});
