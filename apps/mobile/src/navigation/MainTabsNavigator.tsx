import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { TodayScreen } from '../screens/today/TodayScreen';
import { FinanceScreen } from '../screens/finance/FinanceScreen';
import { AssistantScreen } from '../screens/assistant/AssistantScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { useTheme } from '../theme';
import type { MainTabsParamList } from './types';

const Tab = createBottomTabNavigator<MainTabsParamList>();

const ICONS: Record<keyof MainTabsParamList, string> = {
  Dashboard: '🏠',
  Today: '🗓',
  Finance: '💰',
  Assistant: '✨',
  Profile: '👤',
};

export function MainTabsNavigator() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const LABELS: Record<keyof MainTabsParamList, string> = {
    Dashboard: t('tabs.dashboard'),
    Today: t('tabs.today'),
    Finance: t('tabs.finance'),
    Assistant: t('tabs.assistant'),
    Profile: t('tabs.profile'),
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.bgElevated,
          borderTopColor: colors.border,
          height: 64,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarLabel: LABELS[route.name],
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: focused ? 22 : 20 }}>{ICONS[route.name]}</Text>
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Today" component={TodayScreen} />
      <Tab.Screen name="Finance" component={FinanceScreen} />
      <Tab.Screen name="Assistant" component={AssistantScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
