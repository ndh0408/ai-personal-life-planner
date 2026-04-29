import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { Text, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeScreen } from '../screens/main/HomeScreen';
import { TodayScreen } from '../screens/main/TodayScreen';
import { MoneyScreen } from '../screens/main/MoneyScreen';
import { AssistantScreen } from '../screens/main/AssistantScreen';
import { SettingsScreen } from '../screens/main/SettingsScreen';
import type { MainTabParamList } from './types';
import { colors, spacing, typography } from '../theme';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, string> = {
  Home: '◉',
  Today: '◐',
  Money: '◇',
  Assistant: '✦',
  Settings: '◎',
};

function TabIcon({ name, focused }: { name: keyof MainTabParamList; focused: boolean }) {
  return (
    <View style={styles.iconWrap}>
      <Text style={[styles.icon, { color: focused ? colors.accent.base : colors.text.muted }]}>
        {ICONS[name]}
      </Text>
    </View>
  );
}

export function MainTabs() {
  const { t } = useTranslation();
  // Tab bar height needs to grow with the device's bottom safe area —
  // gesture-bar Androids and iPhone X+ would otherwise clip the labels.
  const insets = useSafeAreaInsets();
  const barHeight = 56 + Math.max(insets.bottom, 8);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent.base,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarStyle: [styles.bar, { height: barHeight, paddingBottom: insets.bottom || 8 }],
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: { paddingTop: 6 },
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
    paddingTop: 6,
  },
  label: { ...typography.micro, marginTop: 2 },
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 18, lineHeight: 20, fontWeight: '600' },
});

void spacing;
