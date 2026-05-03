import React from 'react';
import { Platform, ScrollView, StatusBar, View, type ViewStyle, type StyleProp } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAurora } from './AuroraProvider';
import { AuroraCanvas } from './AuroraCanvas';

interface Props {
  children: React.ReactNode;
  scroll?: boolean;
  /** Extra bottom padding for the floating capture FAB. */
  bottomInset?: number;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Aurora screen frame: canvas + safe-area padding + scroll. Replaces
 * v2's ScreenContainer for screens migrated to Aurora.
 */
export function AuroraScreen({
  children,
  scroll = true,
  bottomInset = 96,
  contentStyle,
}: Props) {
  const t = useAurora();
  const insets = useSafeAreaInsets();

  const inner = (
    <View
      style={[
        {
          paddingTop: insets.top + t.space['3'],
          paddingBottom: bottomInset + insets.bottom,
          paddingHorizontal: Platform.OS === 'ios' ? t.screenEdge.ios : t.screenEdge.android,
          gap: t.space['6'],
        },
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <AuroraCanvas>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent={Platform.OS === 'android'}
      />
      {scroll ? (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </AuroraCanvas>
  );
}
