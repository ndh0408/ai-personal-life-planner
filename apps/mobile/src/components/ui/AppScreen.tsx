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
}

export function AppScreen({ children, scroll = true, edgeToEdge = false, noBottomInset = false }: Props) {
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  paddingNone: { paddingHorizontal: 0 },
  paddingDefault: { paddingHorizontal: spacing.xl },
  contentVertical: { paddingTop: spacing['2xl'], paddingBottom: spacing['3xl'], flexGrow: 1 },
});
