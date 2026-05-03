import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAurora, FlowText } from '../../aurora';
import { useCapture } from '../../components/v2';
import { haptic } from '../../platform/haptics';

const PILL_HEIGHT = 62;
const TAB_BAR_BASE = PILL_HEIGHT + 12 + 16;
export const AURORA_TAB_BAR_HEIGHT = TAB_BAR_BASE;

const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  Today: { active: 'sunny', inactive: 'sunny-outline' },
  Plan: { active: 'calendar', inactive: 'calendar-outline' },
  Money: { active: 'wallet', inactive: 'wallet-outline' },
  Health: { active: 'pulse', inactive: 'pulse-outline' },
  Mind: { active: 'sparkles', inactive: 'sparkles-outline' },
};

/**
 * Aurora tab bar — Pencil R45 layout. Floating glass pill with icon+label
 * tabs; active tab gets a solid champagne-pearl fill (`palette.accent`).
 * A capture FAB floats above the right of the bar.
 */
export function AuroraTabBar(props: BottomTabBarProps) {
  const t = useAurora();
  const insets = useSafeAreaInsets();
  const capture = useCapture();
  const { state, descriptors, navigation } = props;

  return (
    <>
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 21,
          paddingTop: 12,
          paddingBottom: 21 + insets.bottom,
          alignItems: 'center',
        }}
      >
        <View
          style={{
            width: '100%',
            height: PILL_HEIGHT,
            borderRadius: 36,
            backgroundColor: 'rgba(255,255,255,0.10)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.20)',
            padding: 4,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const focused = state.index === index;
            const label = (options.tabBarLabel as string) ?? route.name;
            const icons = TAB_ICONS[route.name] ?? {
              active: 'ellipse',
              inactive: 'ellipse-outline',
            };

            const onPress = () => {
              haptic('selection');
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                onPress={onPress}
                style={{
                  flex: 1,
                  height: '100%',
                  borderRadius: 26,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  backgroundColor: focused ? t.palette.accent : 'transparent',
                }}
              >
                <Ionicons
                  name={focused ? icons.active : icons.inactive}
                  size={18}
                  color={focused ? t.palette.canvasA : t.palette.inkTertiary}
                />
                <FlowText
                  variant="kicker"
                  style={{
                    color: focused ? t.palette.canvasA : t.palette.inkTertiary,
                    fontSize: 9,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                  }}
                >
                  {label}
                </FlowText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Capture FAB — floats above right side of tab bar */}
      <Pressable
        onPress={() => {
          haptic('confirm');
          capture.open();
        }}
        accessibilityRole="button"
        accessibilityLabel="Capture"
        style={{
          position: 'absolute',
          right: 20,
          bottom: TAB_BAR_BASE + insets.bottom + 4,
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: t.palette.accent,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: t.palette.accent,
          shadowOpacity: 0.45,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 12,
        }}
      >
        <Ionicons name="add" size={28} color={t.palette.canvasA} />
      </Pressable>
    </>
  );
}
