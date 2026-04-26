import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

interface Props {
  label: string;
  hint?: string;
  glyph: string;
  onPress: () => void;
}

export function QuickActionButton({ label, hint, glyph, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.04)' }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <View style={styles.glyphWrap}>
        <Text style={styles.glyph}>{glyph}</Text>
      </View>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  pressed: { backgroundColor: colors.surfaceAlt },
  glyphWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.accent.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: 18 },
  text: { flex: 1 },
  label: { ...typography.bodyEm, color: colors.text.primary },
  hint: { ...typography.caption, color: colors.text.muted, marginTop: 2 },
});
