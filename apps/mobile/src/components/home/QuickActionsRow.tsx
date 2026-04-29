import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, spacing, typography } from '../../theme';
import { Icon, Text, type IconName } from '../ui';
import { useResponsive } from '../../hooks/useResponsive';

type ActionKey = 'capture' | 'expense' | 'task' | 'checkin' | 'askAi';

interface Action {
  key: ActionKey;
  onPress: () => void;
  disabled?: boolean;
}

interface Props {
  actions: Action[];
}

const ICON_FOR: Record<ActionKey, IconName> = {
  capture: 'create-outline',
  expense: 'cash-outline',
  task: 'checkmark-circle-outline',
  checkin: 'pulse-outline',
  askAi: 'sparkles-outline',
};

const TINT_FOR: Record<ActionKey, string> = {
  capture: colors.accent.base,
  expense: colors.expense.base,
  task: colors.status.info,
  checkin: colors.income.base,
  askAi: colors.accent.base,
};

export function QuickActionsRow({ actions }: Props) {
  const { t } = useTranslation();
  const { device, isLargeFont } = useResponsive();
  const tileWidth =
    device === 'smallPhone' ? 100 : device === 'tablet' ? 132 : isLargeFont ? 124 : 112;

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
        {actions.map((a) => {
          const tint = TINT_FOR[a.key];
          return (
            <Pressable
              key={a.key}
              onPress={a.onPress}
              disabled={a.disabled}
              accessibilityRole="button"
              accessibilityLabel={t(`home.quickActions.${a.key}`)}
              style={({ pressed }) => [
                styles.tile,
                { width: tileWidth },
                a.disabled && styles.tileDisabled,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.iconHalo, { backgroundColor: tint + '22' }]}>
                <Icon name={ICON_FOR[a.key]} size={22} color={tint} />
              </View>
              <Text style={styles.label} numberOfLines={2}>
                {t(`home.quickActions.${a.key}`)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    gap: 8,
    minHeight: 100,
  },
  iconHalo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileDisabled: { opacity: 0.45 },
  pressed: {
    backgroundColor: colors.surfaceAlt,
    transform: [{ scale: 0.97 }],
    borderColor: colors.borderStrong,
  },
  label: { ...typography.caption, color: colors.text.primary, textAlign: 'center' },
});
