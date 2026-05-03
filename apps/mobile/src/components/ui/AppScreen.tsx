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
import { AuroraCanvas } from '../../aurora';

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

  // Round 43: wrap the v1 frame in <AuroraCanvas> so every screen using
  // AppScreen (auth, onboarding, tasks, privacy, ai-settings, ...) inherits
  // the Aurora living gradient background without requiring a per-screen
  // rewrite. Existing v1 components (Text, Button, Chip, TextField) sit on
  // top untouched — their warm-bone ink reads well on the indigo canvas.
  // Full Aurora primitive migration for these screens lands R44+.
  return (
    <AuroraCanvas>
      <SafeAreaView style={styles.root} edges={noBottomInset ? ['top'] : ['top', 'bottom']}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={kavBehavior}
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
    </AuroraCanvas>
  );
}

const styles = StyleSheet.create({
  // Round 43: transparent so the AuroraCanvas behind shows through.
  root: { flex: 1, backgroundColor: 'transparent' },
  flex: { flex: 1 },
  contentVertical: { paddingTop: spacing['2xl'], paddingBottom: spacing.xl, flexGrow: 1 },
  footer: {
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'transparent',
  },
});
