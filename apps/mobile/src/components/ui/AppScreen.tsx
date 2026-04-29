import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';
import { useResponsive } from '../../hooks/useResponsive';

interface Props {
  children: React.ReactNode;
  scroll?: boolean;
  /** Skip the default horizontal padding when the screen draws full-bleed surfaces. */
  edgeToEdge?: boolean;
  /** Bottom inset suppression (e.g., a tab bar already inset). */
  noBottomInset?: boolean;
  /**
   * Optional sticky footer rendered below the (scrolling) content. Useful for
   * Quick Capture bars or persistent CTAs that should stay above the keyboard.
   */
  footer?: React.ReactNode;
  /** Pull-to-refresh control passed straight through to the inner ScrollView. */
  refreshControl?: React.ReactElement;
}

export function AppScreen({
  children,
  scroll = true,
  edgeToEdge = false,
  noBottomInset = false,
  footer,
  refreshControl,
}: Props) {
  // Tablet / large-phone landscape: cap the readable column width so a card
  // doesn't span 1024dp. Phones below the breakpoint stay edge-to-edge.
  const { width } = useWindowDimensions();
  const { device, contentMaxWidth, horizontalPadding } = useResponsive();
  const horizontalPad = edgeToEdge ? 0 : horizontalPadding;
  const lateralMargin = Math.max(0, (width - contentMaxWidth) / 2);

  // KAV: iOS uses padding, Android uses 'height' (the older 'undefined'
  // value made it a no-op and the keyboard covered Save buttons). On Android
  // we also defer to the OS adjustResize where possible.
  const kavBehavior = Platform.OS === 'ios' ? 'padding' : 'height';

  const containerStyle = {
    paddingHorizontal: horizontalPad,
    paddingLeft: horizontalPad + lateralMargin,
    paddingRight: horizontalPad + lateralMargin,
  };

  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={[containerStyle, styles.contentVertical]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[containerStyle, styles.contentVertical, styles.flex]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.root} edges={noBottomInset ? ['top'] : ['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.canvas} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={kavBehavior}
        // Tablet / large device: lean toward 'padding' which feels less jumpy
        // on bigger screens.
        keyboardVerticalOffset={device === 'tablet' ? 0 : Platform.OS === 'ios' ? 0 : 0}
      >
        {inner}
        {footer ? (
          <View style={[styles.footer, { paddingHorizontal: horizontalPad + lateralMargin }]}>
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  contentVertical: { paddingTop: spacing['2xl'], paddingBottom: spacing.xl, flexGrow: 1 },
  footer: {
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.canvas,
  },
});
