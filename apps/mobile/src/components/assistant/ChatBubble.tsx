import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import { Text } from '../ui';
import type { AiMessage } from '../../services/api/assistant.service';

export function ChatBubble({ msg }: { msg: AiMessage }) {
  const isUser = msg.role === 'USER';
  return (
    <View style={[styles.row, isUser && styles.rowUser]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <Text
          style={[
            styles.text,
            { color: isUser ? colors.text.inverse : colors.text.primary },
          ]}
        >
          {msg.content}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  rowUser: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  bubbleUser: {
    backgroundColor: colors.accent.base,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderBottomLeftRadius: 4,
  },
  text: { ...typography.body, lineHeight: 22 },
});
