import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { colors } from '../../theme';

interface Props {
  name?: string | null;
  size?: number;
  /** Optional override accent. Default uses the warm terracotta accent. */
  tint?: string;
}

/**
 * Initials avatar — derives 1-2 letters from the supplied name. Falls back
 * to a generic glyph if the name is empty (e.g. user just signed up).
 */
export function Avatar({ name, size = 48, tint = colors.accent.base }: Props) {
  const initials = deriveInitials(name);
  const fontSize = Math.round(size * 0.42);
  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: tint + '22',
          borderColor: tint + '55',
        },
      ]}
    >
      <Text style={{ color: tint, fontSize, fontWeight: '700' }}>{initials}</Text>
    </View>
  );
}

function deriveInitials(name?: string | null): string {
  if (!name) return '◍';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '◍';
  if (parts.length === 1) {
    const w = parts[0];
    return w.slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
