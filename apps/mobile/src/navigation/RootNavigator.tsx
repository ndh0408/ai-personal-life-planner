import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/auth.store';
import { useTheme } from '../theme';
import { SplashScreen } from '../screens/SplashScreen';
import { AuthNavigator } from './AuthNavigator';
import { OnboardingNavigator } from './OnboardingNavigator';
import { MainTabsNavigator } from './MainTabsNavigator';
import { CreateTaskScreen } from '../screens/tasks/CreateTaskScreen';
import { CreateHabitScreen } from '../screens/habits/CreateHabitScreen';
import { ScheduleDetailScreen } from '../screens/today/ScheduleDetailScreen';
import { SleepMoodCheckinScreen } from '../screens/today/SleepMoodCheckinScreen';
import { WeeklyReportScreen } from '../screens/reports/WeeklyReportScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { LanguageSettingsScreen } from '../screens/settings/LanguageSettingsScreen';
import { AIChatScreen } from '../screens/ai/AIChatScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { isDark, colors } = useTheme();
  const status = useAuthStore((s) => s.status);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: colors.bg,
      card: colors.bgElevated,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {status === 'loading' ? (
          <Stack.Screen name="Splash" component={SplashScreen} />
        ) : status === 'unauthenticated' ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabsNavigator} />
            <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
            <Stack.Group screenOptions={{ presentation: 'modal', headerShown: true }}>
              <Stack.Screen name="CreateTask" component={CreateTaskScreen} options={{ title: 'New task' }} />
              <Stack.Screen name="CreateHabit" component={CreateHabitScreen} options={{ title: 'New habit' }} />
              <Stack.Screen name="ScheduleDetail" component={ScheduleDetailScreen} options={{ title: 'Schedule' }} />
              <Stack.Screen name="SleepMoodCheckin" component={SleepMoodCheckinScreen} options={{ title: 'Check-in' }} />
              <Stack.Screen name="WeeklyReport" component={WeeklyReportScreen} options={{ title: 'Weekly report' }} />
              <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
              <Stack.Screen
                name="LanguageSettings"
                component={LanguageSettingsScreen}
                options={{ title: 'Language' }}
              />
              <Stack.Screen name="AIChat" component={AIChatScreen} options={{ title: 'AI assistant' }} />
            </Stack.Group>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
