import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';

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
}

export function AppScreen({
  children,
  scroll = true,
  edgeToEdge = false,
  noBottomInset = false,
  footer,
}: Props) {
  const padding = edgeToEdge ? styles.paddingNone : styles.paddingDefault;
  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={[padding, styles.contentVertical]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[padding, styles.contentVertical, styles.flex]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.root} edges={noBottomInset ? ['top'] : ['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.canvas} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {inner}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  paddingNone: { paddingHorizontal: 0 },
  paddingDefault: { paddingHorizontal: spacing.xl },
  contentVertical: { paddingTop: spacing['2xl'], paddingBottom: spacing.xl, flexGrow: 1 },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.canvas,
  },
});
