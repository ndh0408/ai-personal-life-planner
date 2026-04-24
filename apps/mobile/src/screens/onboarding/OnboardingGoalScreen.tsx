import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { Screen, Button, Chip } from '../../components/ui';
import { profileApi } from '../../services/api/profile.api';
import type { OnboardingScreenProps } from '../../navigation/types';

const GOALS = [
  { value: 'PRODUCTIVE', label: 'Be more productive' },
  { value: 'HEALTHY', label: 'Live healthier' },
  { value: 'SLEEP_EARLY', label: 'Sleep earlier' },
  { value: 'STUDY', label: 'Focus on studying' },
  { value: 'LOSE_WEIGHT', label: 'Lose weight' },
  { value: 'GAIN_WEIGHT', label: 'Gain weight' },
  { value: 'BALANCE', label: 'Find balance' },
] as const;

export function OnboardingGoalScreen({ navigation }: OnboardingScreenProps<'Goal'>) {
  const { colors, spacing } = useTheme();
  const [goal, setGoal] = useState<typeof GOALS[number]['value'] | null>(null);
  const [saving, setSaving] = useState(false);

  const onContinue = async () => {
    if (!goal) {
      navigation.navigate('Schedule');
      return;
    }
    setSaving(true);
    try {
      await profileApi.update({ mainGoal: goal } as never);
      navigation.navigate('Schedule');
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: spacing.xs }}>
          What's your main goal?
        </Text>
        <Text style={{ color: colors.textMuted, marginBottom: spacing.xl }}>
          Pick one. The AI will lean toward this when planning your days.
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {GOALS.map((g) => (
            <Chip
              key={g.value}
              label={g.label}
              selected={goal === g.value}
              onPress={() => setGoal(g.value)}
            />
          ))}
        </View>
      </View>
      <Button title="Continue" size="lg" fullWidth loading={saving} onPress={onContinue} />
    </Screen>
  );
}
