import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme, useResponsive } from '../../theme';
import { Screen, Button, Input, Chip, StepProgress } from '../../components/ui';
import type { OnboardingScreenProps } from '../../navigation/types';
import { useOnboardingStore } from '../../store/onboarding.store';

/**
 * Round 21 — Step 2/3. The single basic-info screen.
 *
 * Asks the absolute minimum:
 *   - Tên muốn được gọi (required)
 *   - Mục tiêu chính (required, chip select)
 *
 * Optional:
 *   - Giờ ngủ / dậy — collapsed under "More" so users who care can set
 *     them; everyone else gets sensible defaults from the store
 *     (06:30 / 23:00 / 09:00 / 18:00).
 *
 * Body metrics, occupation, dietary preference, salary, wallet toggles,
 * timezone (auto-detected) — all dropped from required onboarding;
 * editable later in Profile settings.
 */
const GOALS = [
  { key: 'PRODUCTIVE', icon: '⚡' },
  { key: 'FINANCIAL_STABILITY', icon: '💰' },
  { key: 'SLEEP_EARLY', icon: '🌙' },
  { key: 'HEALTHY', icon: '🥗' },
  { key: 'STUDY', icon: '📚' },
  { key: 'BALANCE', icon: '⚖️' },
] as const;

export function OnboardingBasicsScreen({ navigation }: OnboardingScreenProps<'Basics'>) {
  const { colors, spacing, typography } = useTheme();
  const { t } = useTranslation();
  const { gridColumns, isTablet } = useResponsive();
  const draft = useOnboardingStore((s) => s.draft);
  const patch = useOnboardingStore((s) => s.patch);
  const [showMore, setShowMore] = useState(false);

  const canContinue = draft.fullName.trim().length > 0 && draft.mainGoal !== '';
  const cellWidth = `${100 / gridColumns - 2}%` as const;

  return (
    <Screen scroll>
      <StepProgress total={3} current={2} />
      <View style={{ maxWidth: isTablet ? 640 : undefined, alignSelf: isTablet ? 'center' : 'stretch', width: '100%' }}>
        <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.xs }]}>
          {t('onboarding.basics.title')}
        </Text>
        <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.xl }]}>
          {t('onboarding.basics.subtitle')}
        </Text>

        <Input
          label={t('onboarding.basics.fullName')}
          placeholder={t('onboarding.basics.fullNamePlaceholder')}
          value={draft.fullName}
          onChangeText={(v) => patch({ fullName: v })}
        />

        <Text
          style={[
            typography.caption,
            { color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm },
          ]}
        >
          {t('onboarding.basics.mainGoal')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {GOALS.map((g) => (
            <View key={g.key} style={{ width: cellWidth }}>
              <Chip
                label={`${g.icon}  ${t(`onboarding.goal.mainGoals.${g.key}`)}`}
                selected={draft.mainGoal === g.key}
                onPress={() => patch({ mainGoal: g.key })}
              />
            </View>
          ))}
        </View>

        {/* Optional advanced — collapsed by default. */}
        <View
          style={{
            marginTop: spacing.xl,
            padding: spacing.md,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <Text style={[typography.bodyStrong, { color: colors.text }]}>
            {t('onboarding.basics.moreTitle')}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
            {t('onboarding.basics.moreHint')}
          </Text>
          {showMore ? (
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              <Input
                label={t('onboarding.schedule.wakeTime')}
                placeholder="06:30"
                value={draft.usualWakeTime}
                onChangeText={(v) => patch({ usualWakeTime: v })}
                autoCapitalize="none"
              />
              <Input
                label={t('onboarding.schedule.sleepTime')}
                placeholder="23:00"
                value={draft.usualSleepTime}
                onChangeText={(v) => patch({ usualSleepTime: v })}
                autoCapitalize="none"
              />
            </View>
          ) : null}
          <Button
            title={
              showMore ? t('onboarding.basics.hideMore') : t('onboarding.basics.showMore')
            }
            variant="ghost"
            size="sm"
            onPress={() => setShowMore((v) => !v)}
            style={{ alignSelf: 'flex-start', marginTop: spacing.sm }}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl }}>
          <Button
            title={t('common.back')}
            variant="secondary"
            onPress={() => navigation.goBack()}
            style={{ flex: 1 }}
          />
          <Button
            title={t('common.next')}
            disabled={!canContinue}
            onPress={() => navigation.navigate('AISetupOnboarding')}
            style={{ flex: 2 }}
          />
        </View>
      </View>
    </Screen>
  );
}
