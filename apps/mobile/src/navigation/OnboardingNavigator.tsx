import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingWelcomeScreen } from '../screens/onboarding/OnboardingWelcomeScreen';
import { OnboardingBasicsScreen } from '../screens/onboarding/OnboardingBasicsScreen';
import { OnboardingAISetupScreen } from '../screens/onboarding/OnboardingAISetupScreen';
import type { OnboardingStackParamList } from './types';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

/**
 * Round 21 — collapsed from 5 steps (Welcome → Profile → Goal →
 * Schedule → Finance) to 3 (Welcome → Basics → AI setup). Body
 * metrics, salary, and detailed schedule are now in Profile settings,
 * not required upfront. The AI setup step doubles as the
 * onboarding-finalisation point — both the success path and the
 * "Skip for now" path call `profileApi.update` + create the default
 * Cash wallet + flip `auth.completeOnboarding()`.
 */
export function OnboardingNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={OnboardingWelcomeScreen} />
      <Stack.Screen name="Basics" component={OnboardingBasicsScreen} />
      <Stack.Screen name="AISetupOnboarding" component={OnboardingAISetupScreen} />
    </Stack.Navigator>
  );
}
