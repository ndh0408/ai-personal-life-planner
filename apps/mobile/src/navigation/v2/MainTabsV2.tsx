import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { TodayScreenV2 } from '../../screens/v2/TodayScreen';
import { PlanScreenV2 } from '../../screens/v2/PlanScreen';
import { MoneyScreenV2 } from '../../screens/v2/MoneyScreen';
import { HealthScreenV2 } from '../../screens/v2/HealthScreen';
import { MindScreenV2 } from '../../screens/v2/MindScreen';
import { TabBarV2, TAB_BAR_HEIGHT } from './TabBar';
import { FloatingCaptureButton, useCapture } from '../../components/v2';
import { useTheme } from '../../theme/v2';

export type MainTabV2ParamList = {
  Today: undefined;
  Plan: undefined;
  Money: undefined;
  Health: undefined;
  Mind: undefined;
};

const Tab = createBottomTabNavigator<MainTabV2ParamList>();

/**
 * Five-tab v2 shell. The floating capture button is rendered ONCE above all
 * screens here — keeping it inside the navigator means screens never have
 * to know about it, but it sits above the tab bar with the same z-order
 * regardless of which tab is active.
 */
export function MainTabsV2() {
  const { t } = useTranslation();
  const theme = useTheme();
  const capture = useCapture();

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bg.canvas }}>
      <Tab.Navigator
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <TabBarV2 {...props} />}
      >
        <Tab.Screen
          name="Today"
          component={TodayScreenV2}
          options={{ tabBarLabel: t('tabsV2.today') }}
        />
        <Tab.Screen
          name="Plan"
          component={PlanScreenV2}
          options={{ tabBarLabel: t('tabsV2.plan') }}
        />
        <Tab.Screen
          name="Money"
          component={MoneyScreenV2}
          options={{ tabBarLabel: t('tabsV2.money') }}
        />
        <Tab.Screen
          name="Health"
          component={HealthScreenV2}
          options={{ tabBarLabel: t('tabsV2.health') }}
        />
        <Tab.Screen
          name="Mind"
          component={MindScreenV2}
          options={{ tabBarLabel: t('tabsV2.mind') }}
        />
      </Tab.Navigator>
      <FloatingCaptureButton onPress={() => capture.open()} tabBarHeight={TAB_BAR_HEIGHT} />
    </View>
  );
}
