import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useAurora, FlowText } from '../../aurora';
import { haptic } from '../../platform/haptics';

const TAB_BAR_BASE = 64;

/**
 * Aurora tab bar — frosted, no icons, single-letter pill markers.
 * Floating capture FAB sits 18pt above this bar across all tabs.
 */
export function AuroraTabBar(props: BottomTabBarProps) {
  const t = useAurora();
  const insets = useSafeAreaInsets();
  const { state, descriptors, navigation } = props;
  const totalHeight = TAB_BAR_BASE + insets.bottom;

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: totalHeight,
        paddingBottom: insets.bottom,
        flexDirection: 'row',
        backgroundColor: t.palette.glassTint,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
      }}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const label = (options.tabBarLabel as string) ?? route.name;

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
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 12 }}
          >
            <FlowText variant="caption" tone={focused ? 'accent' : 'tertiary'}>
              {label}
            </FlowText>
            <View
              style={{
                width: focused ? 16 : 4,
                height: 3,
                borderRadius: 2,
                marginTop: 6,
                backgroundColor: focused ? t.palette.accent : 'transparent',
              }}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

export const AURORA_TAB_BAR_HEIGHT = TAB_BAR_BASE;
