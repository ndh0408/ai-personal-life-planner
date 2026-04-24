import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { APP_NAME } from '../constants';

export function SplashScreen() {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
      }}
    >
      <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: 16 }}>
        {APP_NAME}
      </Text>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
