import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { Screen, Button } from '../../components/ui';
import type { OnboardingScreenProps } from '../../navigation/types';

export function OnboardingWelcomeScreen({ navigation }: OnboardingScreenProps<'Welcome'>) {
  const { colors, spacing } = useTheme();
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={{ fontSize: 36, fontWeight: '800', color: colors.text }}>
          A planner that
        </Text>
        <Text style={{ fontSize: 36, fontWeight: '800', color: colors.primary, marginBottom: spacing.lg }}>
          works with your day.
        </Text>
        <Text style={{ fontSize: 16, color: colors.textMuted, lineHeight: 24 }}>
          We'll ask a few quick questions so the AI can build a daily plan that
          actually fits your life — your sleep, energy, meals and goals.
        </Text>
      </View>
      <Button title="Let's go" size="lg" fullWidth onPress={() => navigation.navigate('Profile')} />
    </Screen>
  );
}
