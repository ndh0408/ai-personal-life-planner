import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, spacing, typography } from '../../theme';
import { Text } from '../ui';

interface Action {
  key: 'capture' | 'expense' | 'task' | 'checkin' | 'askAi';
  glyph: string;
  onPress: () => void;
  disabled?: boolean;
}

interface Props {
  actions: Action[];
}

export function QuickActionsRow({ actions }: Props) {
  const { t } = useTranslation();
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <Text variant="kicker" style={{ marginBottom: spacing.sm }}>
        {t('home.quickActions.title')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.md }}
      >
        {actions.map((a) => (
          <Pressable
            key={a.key}
            onPress={a.onPress}
            disabled={a.disabled}
            style={({ pressed }) => [
              styles.tile,
              a.disabled && styles.tileDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.glyph}>{a.glyph}</Text>
            <Text style={styles.label}>{t(`home.quickActions.${a.key}`)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 110,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    gap: 6,
  },
  tileDisabled: { opacity: 0.45 },
  pressed: { backgroundColor: colors.surfaceAlt, transform: [{ scale: 0.98 }] },
  glyph: { fontSize: 22 },
  label: { ...typography.caption, color: colors.text.primary, textAlign: 'center' },
});
