import React from 'react';
import { Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

/**
 * Editorial eyebrow — the small caps + extra-tracked label that sits
 * above section headings in magazines. Optionally pairs with a thin
 * rule line that bleeds to the right edge of the available space, the
 * way a column header does on a printed page.
 *
 *   ```
 *   ━━━━━━━━ TODAY · MORNING ─────────────────
 *   ```
 *
 * Round 22 / Editorial Calm.
 */
type Props = {
  children: string;
  /** Render the bleed line. Default true. */
  rule?: boolean;
  /** Text tone — defaults to muted. */
  tone?: 'default' | 'primary' | 'muted';
  style?: ViewStyle;
  textStyle?: TextStyle;
};

export function Eyebrow({ children, rule = true, tone = 'muted', style, textStyle }: Props) {
  const { colors, typography, spacing } = useTheme();
  const color =
    tone === 'primary' ? colors.primary : tone === 'default' ? colors.text : colors.textMuted;
  const ruleColor =
    tone === 'primary' ? colors.primary : tone === 'default' ? colors.text : colors.border;
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
        style,
      ]}
    >
      <Text style={[typography.eyebrow, { color }, textStyle]}>{children}</Text>
      {rule ? (
        <View
          style={{
            flex: 1,
            height: 1,
            backgroundColor: ruleColor,
            opacity: tone === 'primary' ? 0.5 : 0.35,
          }}
        />
      ) : null}
    </View>
  );
}
