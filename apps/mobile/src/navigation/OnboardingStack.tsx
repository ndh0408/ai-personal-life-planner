import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WelcomeScreen } from '../screens/onboarding/WelcomeScreen';
import { BasicSetupScreen } from '../screens/onboarding/BasicSetupScreen';
import { AISetupScreen } from '../screens/onboarding/AISetupScreen';
import type { OnboardingStackParamList } from './types';
import { colors } from '../theme';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.canvas },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="BasicSetup" component={BasicSetupScreen} />
      <Stack.Screen name="AISetup" component={AISetupScreen} />
    </Stack.Navigator>
  );
}
