import React from 'react';
import { Platform, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../../theme';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle | ViewStyle[];
  emphasis?: 'default' | 'elevated' | 'flat';
}

export function Card({ children, onPress, style, emphasis = 'default' }: Props) {
  const styleArr: (ViewStyle | undefined | false | (ViewStyle | ViewStyle[])[])[] = [
    styles.card,
    emphasis === 'elevated' && styles.elevated,
    emphasis === 'flat' && styles.flat,
    emphasis !== 'flat' && styles.shadow,
    style as ViewStyle,
  ];

  if (!onPress) return <View style={styleArr as ViewStyle[]}>{children}</View>;

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.04)' }}
      style={({ pressed }) =>
        [...(styleArr as ViewStyle[]), pressed && styles.pressed].filter(Boolean) as ViewStyle[]
      }
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  elevated: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.borderStrong,
  },
  flat: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    padding: 0,
  },
  // Subtle elevation. iOS gets a soft drop shadow; Android gets the
  // native elevation flag — RN merges these into one Platform.select on render.
  shadow: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.35,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    },
    android: {
      elevation: 2,
    },
    default: {},
  }) as ViewStyle,
  pressed: {
    backgroundColor: colors.surfaceAlt,
    transform: [{ scale: 0.985 }],
  },
});
