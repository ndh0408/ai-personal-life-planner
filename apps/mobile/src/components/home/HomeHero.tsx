import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, spacing } from '../../theme';
import { Avatar, Button, Icon, Text } from '../ui';

interface Props {
  aiEnabled: boolean;
  onAddKey: () => void;
  onCapture: () => void;
  onPlan: () => void;
  /** Display name shown next to the avatar. */
  userName?: string | null;
}

function timeOfDayKey(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const h = new Date().getHours();
  if (h < 5) return 'night';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 22) return 'evening';
  return 'night';
}

export function HomeHero({ aiEnabled, onAddKey, onCapture, onPlan, userName }: Props) {
  const { t } = useTranslation();
  const tod = timeOfDayKey();

  if (!aiEnabled) {
    return (
      <View style={styles.heroDisabled}>
        <View style={styles.headerRow}>
          <Avatar name={userName} size={40} />
          <View style={{ flex: 1 }}>
            <Text variant="caption" style={{ color: colors.text.secondary }}>
              {t(`home.timeOfDay.${tod}`)}
            </Text>
            <Text variant="bodyEm" numberOfLines={1}>
              {userName ?? t('home.greetingFallback')}
            </Text>
          </View>
        </View>
        <Text variant="title" style={{ marginTop: spacing.md }}>
          {t('home.heroNoAi.title')}
        </Text>
        <Text style={{ color: colors.text.secondary }}>{t('home.heroNoAi.body')}</Text>
        <View style={{ marginTop: spacing.md }}>
          <Button label={t('home.heroNoAi.cta')} onPress={onAddKey} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.hero}>
      <View style={styles.headerRow}>
        <Avatar name={userName} size={40} />
        <View style={{ flex: 1 }}>
          <Text variant="caption" style={{ color: colors.text.secondary }}>
            {t(`home.timeOfDay.${tod}`)}
          </Text>
          <Text variant="bodyEm" numberOfLines={1}>
            {userName
              ? t('home.greeting', { name: userName })
              : t('home.greetingFallback')}
          </Text>
        </View>
      </View>

      <Text variant="title" style={{ marginTop: spacing.md }}>
        {t('home.heroReady.title')}
      </Text>

      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
        <Pressable
          onPress={onCapture}
          style={({ pressed }) => [
            styles.heroCta,
            styles.heroCtaPrimary,
            { flex: 1 },
            pressed && styles.pressed,
          ]}
        >
          <Icon name="add" size={20} color={colors.text.inverse} />
          <Text variant="bodyEm" style={{ color: colors.text.inverse }}>
            {t('home.heroReady.ctaCapture')}
          </Text>
        </Pressable>
        <Pressable
          onPress={onPlan}
          style={({ pressed }) => [
            styles.heroCta,
            styles.heroCtaSecondary,
            { flex: 1 },
            pressed && styles.pressed,
          ]}
        >
          <Icon name="sparkles-outline" size={18} color={colors.accent.base} />
          <Text variant="bodyEm">{t('home.heroReady.ctaPlan')}</Text>
        </Pressable>
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
    borderColor: colors.accent.base + '88',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    gap: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 14,
    borderRadius: radius.md,
    minHeight: 52,
  },
  heroCtaPrimary: { backgroundColor: colors.accent.base },
  heroCtaSecondary: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
});
