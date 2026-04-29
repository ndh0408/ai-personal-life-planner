import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeScreen } from '../screens/main/HomeScreen';
import { TodayScreen } from '../screens/main/TodayScreen';
import { MoneyScreen } from '../screens/main/MoneyScreen';
import { AssistantScreen } from '../screens/main/AssistantScreen';
import { SettingsScreen } from '../screens/main/SettingsScreen';
import type { MainTabParamList } from './types';
import { colors, typography } from '../theme';
import { Icon, type IconName } from '../components/ui/Icon';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICON_FOR: Record<keyof MainTabParamList, { active: IconName; idle: IconName }> = {
  Home: { active: 'home', idle: 'home-outline' },
  Today: { active: 'calendar', idle: 'calendar-outline' },
  Money: { active: 'wallet', idle: 'wallet-outline' },
  Assistant: { active: 'sparkles', idle: 'sparkles-outline' },
  Settings: { active: 'settings', idle: 'settings-outline' },
};

function TabIcon({ name, focused }: { name: keyof MainTabParamList; focused: boolean }) {
  const icon = focused ? ICON_FOR[name].active : ICON_FOR[name].idle;
  return (
    <View style={styles.iconWrap}>
      {focused ? <View style={styles.activePill} /> : null}
      <Icon name={icon} size={22} color={focused ? colors.accent.base : colors.text.muted} />
    </View>
  );
}

export function MainTabs() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const barHeight = 58 + Math.max(insets.bottom, 8);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent.base,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarStyle: [styles.bar, { height: barHeight, paddingBottom: insets.bottom || 8 }],
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: { paddingTop: 8 },
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name as keyof MainTabParamList} focused={focused} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: t('tabs.home') }} />
      <Tab.Screen name="Today" component={TodayScreen} options={{ tabBarLabel: t('tabs.today') }} />
      <Tab.Screen name="Money" component={MoneyScreen} options={{ tabBarLabel: t('tabs.money') }} />
      <Tab.Screen
        name="Assistant"
        component={AssistantScreen}
        options={{ tabBarLabel: t('tabs.assistant') }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: t('tabs.settings') }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: 4,
  },
  label: { ...typography.micro, marginTop: 4, letterSpacing: 0.4 },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 30,
  },
  // Soft "pill" behind the active icon — gives the tab bar a more modern feel
  // without needing a full backdrop.
  activePill: {
    position: 'absolute',
    width: 44,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent.softer,
  },
});
