import React from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/v2';
import { Surface } from './Surface';
import { Text } from './Text';
import { haptic } from '../../platform/haptics';

interface Props {
  /** Small uppercase kicker e.g. "TODAY". */
  kicker?: string;
  /** Big number / hero metric. Tabular figures applied. */
  metric?: string;
  /** Optional unit suffix shown next to metric in muted tone. */
  unit?: string;
  /** Subtitle row under the metric. */
  subtitle?: string;
  /** Optional right-side accessory. */
  accessory?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

/**
 * The bread-and-butter "key/value" card: small label + big number + caption.
 * Used widely on Today, Money, Health screens.
 */
export function Tile({ kicker, metric, unit, subtitle, accessory, onPress, style }: Props) {
  const t = useTheme();
  const inner = (
    <Surface level="surface" pad="5" radius="xl" bordered style={style}>
      <View style={{ gap: t.space['2'] }}>
        {kicker ? (
          <Text variant="kicker" tone="tertiary">
            {kicker}
          </Text>
        ) : null}

        {metric ? (
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.space['1'] }}>
            <Text variant="displayM" tone="primary" style={{ fontVariant: ['tabular-nums'] }}>
              {metric}
            </Text>
            {unit ? (
              <Text variant="bodyM" tone="tertiary">
                {unit}
              </Text>
            ) : null}
          </View>
        ) : null}

        {subtitle ? (
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}

        {accessory ? <View style={{ marginTop: t.space['2'] }}>{accessory}</View> : null}
      </View>
    </Surface>
  );

  if (!onPress) return inner;
  return (
    <Pressable
      onPress={() => {
        haptic('selection');
        onPress();
      }}
    >
      {inner}
    </Pressable>
  );
}
