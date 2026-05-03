import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DarkTheme as NavDark } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/auth.store';
import { AuthStack } from './AuthStack';
import { OnboardingStack } from './OnboardingStack';
import { MainTabsAurora } from './aurora/MainTabsAurora';
import { CaptureProvider } from '../components/v2';
import { CaptureSheetMount } from './v2/CaptureSheetMount';
import { AuroraProvider } from '../aurora';
import { AISettingsScreen } from '../screens/main/AISettingsScreen';
import { SmartEntryScreen } from '../screens/main/SmartEntryScreen';
import { TasksScreen } from '../screens/main/TasksScreen';
import { MealLogScreen } from '../screens/main/MealLogScreen';
import { SleepMoodCheckinScreen } from '../screens/main/SleepMoodCheckinScreen';
import { PreferencesScreen } from '../screens/main/PreferencesScreen';
import { PrivacyScreen } from '../screens/main/PrivacyScreen';
import { MemoryScreen } from '../screens/main/MemoryScreen';
import type { RootStackParamList } from './types';
import { colors } from '../theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...NavDark,
  colors: {
    ...NavDark.colors,
    background: colors.canvas,
    card: colors.canvas,
    text: colors.text.primary,
    primary: colors.accent.base,
    border: colors.border,
    notification: colors.accent.base,
  },
};

function MainStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.canvas },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabsAurora} />
      <Stack.Screen
        name="AISettings"
        component={AISettingsScreen}
        options={{ presentation: 'card', animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="SmartEntry"
        component={SmartEntryScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="Tasks" component={TasksScreen} />
      <Stack.Screen name="MealLog" component={MealLogScreen} />
      <Stack.Screen name="SleepMoodCheckin" component={SleepMoodCheckinScreen} />
      <Stack.Screen name="Preferences" component={PreferencesScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
      <Stack.Screen name="Memory" component={MemoryScreen} />
    </Stack.Navigator>
  );
}

export function RootNavigator() {
  const stage = useAuthStore((s) => s.stage);

  if (stage === 'booting') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent.base} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <AuroraProvider>
        <CaptureProvider>
          {stage === 'unauthenticated' ? (
            <AuthStack />
          ) : stage === 'onboarding' ? (
            <OnboardingStack />
          ) : (
            <MainStack />
          )}
          <CaptureSheetMount />
        </CaptureProvider>
      </AuroraProvider>
    </NavigationContainer>
  );
}
