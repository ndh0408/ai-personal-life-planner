import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { TodayAurora } from '../../screens/aurora/TodayAurora';
import { PlanAurora } from '../../screens/aurora/PlanAurora';
import { MoneyAurora } from '../../screens/aurora/MoneyAurora';
import { HealthAurora } from '../../screens/aurora/HealthAurora';
import { MindAurora } from '../../screens/aurora/MindAurora';
import { AuroraTabBar, AURORA_TAB_BAR_HEIGHT } from './AuroraTabBar';
import { FloatingCaptureButton, useCapture } from '../../components/v2';
import { useAurora } from '../../aurora';

export type MainTabAuroraParamList = {
  Today: undefined;
  Plan: undefined;
  Money: undefined;
  Health: undefined;
  Mind: undefined;
};

const Tab = createBottomTabNavigator<MainTabAuroraParamList>();

export function MainTabsAurora() {
  const { t } = useTranslation();
  const aurora = useAurora();
  const capture = useCapture();

  return (
    <View style={{ flex: 1, backgroundColor: aurora.palette.canvasA }}>
      <Tab.Navigator
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <AuroraTabBar {...props} />}
      >
        <Tab.Screen name="Today" component={TodayAurora} options={{ tabBarLabel: t('tabsV2.today') }} />
        <Tab.Screen name="Plan" component={PlanAurora} options={{ tabBarLabel: t('tabsV2.plan') }} />
        <Tab.Screen name="Money" component={MoneyAurora} options={{ tabBarLabel: t('tabsV2.money') }} />
        <Tab.Screen name="Health" component={HealthAurora} options={{ tabBarLabel: t('tabsV2.health') }} />
        <Tab.Screen name="Mind" component={MindAurora} options={{ tabBarLabel: t('tabsV2.mind') }} />
      </Tab.Navigator>
      <FloatingCaptureButton onPress={() => capture.open()} tabBarHeight={AURORA_TAB_BAR_HEIGHT} />
    </View>
  );
}
