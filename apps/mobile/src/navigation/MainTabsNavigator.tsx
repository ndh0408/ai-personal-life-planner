import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { TodayScreen } from '../screens/today/TodayScreen';
import { FinanceScreen } from '../screens/finance/FinanceScreen';
import { AssistantScreen } from '../screens/assistant/AssistantScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { useTheme, useResponsive } from '../theme';
import type { MainTabsParamList } from './types';

const Tab = createBottomTabNavigator<MainTabsParamList>();

/**
 * Bottom tab icons — Round 21 swap from emoji to monochrome
 * Ionicons. Filled variant when focused, outline when not, matching
 * iOS / Material patterns. Names map 1-1 with `MainTabsParamList`.
 */
const ICONS: Record<
  keyof MainTabsParamList,
  { focused: keyof typeof Ionicons.glyphMap; unfocused: keyof typeof Ionicons.glyphMap }
> = {
  Dashboard: { focused: 'home', unfocused: 'home-outline' },
  Today: { focused: 'calendar', unfocused: 'calendar-outline' },
  Finance: { focused: 'wallet', unfocused: 'wallet-outline' },
  Assistant: { focused: 'sparkles', unfocused: 'sparkles-outline' },
  Profile: { focused: 'person-circle', unfocused: 'person-circle-outline' },
};

export function MainTabsNavigator() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { isTablet, isCompact } = useResponsive();

  const LABELS: Record<keyof MainTabsParamList, string> = {
    Dashboard: t('tabs.dashboard'),
    Today: t('tabs.today'),
    Finance: t('tabs.finance'),
    Assistant: t('tabs.assistant'),
    Profile: t('tabs.profile'),
  };

  // Tab bar height + padding scale with form factor — small phones get
  // a tighter bar, tablets get a roomier one. iOS & Android
  // home-indicator handling is delegated to RN's safe-area integration.
  const barHeight = isTablet ? 76 : isCompact ? 56 : 64;
  const iconSize = isTablet ? 26 : 22;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.bgElevated,
          borderTopColor: colors.border,
          height: barHeight,
          paddingBottom: Platform.select({ ios: 8, android: 6, default: 4 }),
          paddingTop: 6,
        },
        tabBarLabel: LABELS[route.name],
        tabBarLabelStyle: { fontSize: isCompact ? 10 : 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color }) => {
          const { focused: f, unfocused: u } = ICONS[route.name];
          return (
            <Ionicons name={focused ? f : u} size={iconSize} color={color} />
          );
        },
        tabBarAccessibilityLabel: LABELS[route.name],
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
