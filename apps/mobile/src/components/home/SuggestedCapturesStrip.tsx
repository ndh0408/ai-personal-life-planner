/**
 * Horizontal chip strip showing 0-3 quick log suggestions (round 32).
 *
 * Tapping a chip opens SmartEntry with text + mode pre-filled. Per the
 * Microsoft HAI / Google PAIR responsible-agent guidance, we never
 * silent-create — the user lands in the existing editable preview and
 * still has to tap Save.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon, Text } from '../ui';
import { spacing, tokens, radius, typography } from '../../theme';
import type { SuggestedCapture } from '../../services/api/dashboard.service';

interface Props {
  suggestions: SuggestedCapture[];
  onPress: (s: SuggestedCapture) => void;
}

export function SuggestedCapturesStrip({ suggestions, onPress }: Props) {
  const { t } = useTranslation();
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text variant="kicker" style={styles.kicker}>
        {t('home.suggestedCaptures.label', { defaultValue: 'Gợi ý ghi nhanh' })}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {suggestions.map((s, i) => (
          <Pressable
            key={`${s.text}-${i}`}
            onPress={() => onPress(s)}
            accessibilityRole="button"
            accessibilityLabel={s.text}
            hitSlop={6}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
          >
            <Icon name="add-circle" size={14} color={tokens.accent} />
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.chipText} numberOfLines={1}>
                {s.text}
              </Text>
              {s.reason ? (
                <Text style={styles.chipReason} numberOfLines={1}>
                  {s.reason}
                </Text>
              ) : null}
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs, marginTop: spacing.md },
  kicker: { textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '700', opacity: 0.85 },
  scroll: { gap: spacing.sm, paddingRight: spacing.md },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: tokens.hitSize,
    backgroundColor: tokens.accentSoft,
    borderColor: tokens.border.accent,
    borderWidth: 1,
    borderRadius: radius.pill,
    maxWidth: 240,
  },
  chipPressed: { opacity: 0.7 },
  chipText: { ...typography.bodyEm, color: tokens.text.primary },
  chipReason: { ...typography.caption, color: tokens.text.muted, marginTop: 1 },
});
