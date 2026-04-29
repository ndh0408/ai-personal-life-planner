/**
 * Chip strip rendered below the latest assistant bubble (round 32).
 *
 * Each chip is a `MobileAssistantAction` from the SSE stream. Tapping
 * routes to a screen, opens SmartEntry pre-filled, or fires a confirmable
 * action. Per Microsoft HAI / Google PAIR responsible-agent guidance, no
 * chip silently creates / deletes data; SmartEntry's existing preview
 * confirms before persisting.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { Icon, Text, type IconName } from '../ui';
import { spacing, tokens, radius, typography } from '../../theme';
import type { MobileAssistantAction } from '../../services/api/assistantStream.client';

interface Props {
  actions: MobileAssistantAction[];
  onPress: (action: MobileAssistantAction) => void;
}

const ICON_FOR: Record<MobileAssistantAction['type'], IconName> = {
  OPEN_SMART_ENTRY: 'create-outline',
  GENERATE_TODAY_PLAN: 'calendar-outline',
  REFRESH_RECOMMENDATIONS: 'refresh-outline',
  OPEN_SCREEN: 'open-outline',
};

export function AssistantActionChips({ actions, onPress }: Props) {
  if (!actions || actions.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {actions.map((a, i) => (
        <Pressable
          key={`${a.type}-${i}`}
          onPress={() => onPress(a)}
          accessibilityRole="button"
          accessibilityLabel={a.label}
          hitSlop={6}
          style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
        >
          <Icon name={ICON_FOR[a.type]} size={14} color={tokens.accent} />
          <Text style={styles.label} numberOfLines={1}>
            {a.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: tokens.hitSize,
    backgroundColor: tokens.accentSoft,
    borderColor: tokens.border.accent,
    borderWidth: 1,
    borderRadius: radius.pill,
    maxWidth: 220,
  },
  chipPressed: { opacity: 0.7 },
  label: { ...typography.bodyEm, color: tokens.text.primary },
});
