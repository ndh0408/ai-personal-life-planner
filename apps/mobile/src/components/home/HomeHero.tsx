import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, spacing } from '../../theme';
import { Button, Text } from '../ui';

interface Props {
  aiEnabled: boolean;
  onAddKey: () => void;
  onCapture: () => void;
  onPlan: () => void;
}

export function HomeHero({ aiEnabled, onAddKey, onCapture, onPlan }: Props) {
  const { t } = useTranslation();
  if (!aiEnabled) {
    return (
      <View style={styles.heroDisabled}>
        <Text variant="title">{t('home.heroNoAi.title')}</Text>
        <Text>{t('home.heroNoAi.body')}</Text>
        <View style={{ marginTop: spacing.md }}>
          <Button label={t('home.heroNoAi.cta')} onPress={onAddKey} />
        </View>
      </View>
    );
  }
  return (
    <View style={styles.hero}>
      <Text variant="title">{t('home.heroReady.title')}</Text>
      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
        <View style={{ flex: 1 }}>
          <Pressable
            onPress={onCapture}
            style={({ pressed }) => [styles.heroCta, styles.heroCtaPrimary, pressed && styles.pressed]}
          >
            <Text variant="bodyEm" style={{ color: colors.text.inverse }}>
              {t('home.heroReady.ctaCapture')}
            </Text>
          </Pressable>
        </View>
        <View style={{ flex: 1 }}>
          <Pressable
            onPress={onPlan}
            style={({ pressed }) => [styles.heroCta, styles.heroCtaSecondary, pressed && styles.pressed]}
          >
            <Text variant="bodyEm">{t('home.heroReady.ctaPlan')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  heroDisabled: {
    backgroundColor: colors.accent.soft,
    borderColor: colors.accent.base,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  heroCta: {
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  heroCtaPrimary: { backgroundColor: colors.accent.base },
  heroCtaSecondary: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
