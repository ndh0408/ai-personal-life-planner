import React from 'react';
import { Platform, ScrollView, StatusBar, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/v2';

interface Props {
  children: React.ReactNode;
  /** When true, content scrolls; otherwise renders flush. */
  scroll?: boolean;
  /** Extra bottom padding for floating capture button (default 96 for tabs+FAB). */
  bottomInset?: number;
  /** Top spacing — default uses safe-area top + 8. */
  topSpacing?: number;
  contentStyle?: ViewStyle;
}

/**
 * Standard screen frame for v2 tabs. Owns safe-area + status-bar + scroll.
 * Screens render content children only — never their own ScrollView.
 */
export function ScreenContainer({
  children,
  scroll = true,
  bottomInset = 96,
  topSpacing,
  contentStyle,
}: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const top = topSpacing ?? insets.top + 8;

  // Status bar contrast follows theme scheme. iOS gets translucent + light
  // content on dark; Android edge-to-edge handled by setBackgroundColor.
  const statusBarStyle = t.scheme === 'dark' ? 'light-content' : 'dark-content';

  const inner = (
    <View
      style={[
        {
          paddingTop: top,
          paddingBottom: bottomInset + insets.bottom,
          paddingHorizontal: t.space['5'],
          gap: t.space['5'],
        },
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.color.bg.canvas }}>
      <StatusBar
        barStyle={statusBarStyle}
        backgroundColor="transparent"
        translucent={Platform.OS === 'android'}
      />
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </View>
  );
}
