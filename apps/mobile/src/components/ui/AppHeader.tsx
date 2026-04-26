import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../theme';

interface Props {
  title?: string;
  kicker?: string;
  onBack?: () => void;
  trailing?: React.ReactNode;
}

export function AppHeader({ title, kicker, onBack, trailing }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
          >
            <Text style={styles.backLabel}>‹</Text>
          </Pressable>
        ) : null}
        <View>
          {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
          {title ? <Text style={styles.title}>{title}</Text> : null}
        </View>
      </View>
      {trailing ? <View>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPressed: { backgroundColor: colors.surfaceAlt },
  backLabel: {
    color: colors.text.primary,
    fontSize: 22,
    lineHeight: 22,
    marginTop: -2,
  },
  kicker: { ...typography.kicker, color: colors.accent.base, marginBottom: 4 },
  title: { ...typography.title, color: colors.text.primary },
});
