import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { palette, space } from './theme';

interface Props {
  children: React.ReactNode;
  scroll?: boolean;
}

export function Screen({ children, scroll = true }: Props) {
  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.staticContent}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
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
  root: { flex: 1, backgroundColor: palette.canvas },
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: space.xl,
    paddingTop: space['2xl'],
    paddingBottom: space['3xl'],
    flexGrow: 1,
  },
  staticContent: {
    flex: 1,
    paddingHorizontal: space.xl,
    paddingTop: space['2xl'],
    paddingBottom: space['3xl'],
  },
});
