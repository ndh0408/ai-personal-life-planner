import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '../../theme/v2';
import { Text } from '../../components/v2';
import { haptic } from '../../platform/haptics';

const TAB_BAR_BASE = 64;

/**
 * Custom tab bar — calm, restrained, no icons (intentional). Five tabs across,
 * top hairline, transparent edges so the canvas shows through. Matches
 * floating capture button which sits 18pt above the bar.
 */
export function TabBarV2(props: BottomTabBarProps) {
  const t = useTheme();
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
        backgroundColor: t.color.bg.canvas,
        borderTopWidth: 1,
        borderTopColor: t.color.border.hairline,
      }}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const label = (options.tabBarLabel as string) ?? options.title ?? route.name;

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
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={onPress}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 10,
            }}
          >
            <Text
              variant="caption"
              tone={focused ? 'accent' : 'tertiary'}
              style={{ fontWeight: focused ? '600' : '500' }}
            >
              {label}
            </Text>
            <View
              style={{
                width: 4,
                height: 4,
                borderRadius: 2,
                marginTop: 6,
                backgroundColor: focused ? t.color.accent.base : 'transparent',
              }}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

export const TAB_BAR_HEIGHT = TAB_BAR_BASE;
