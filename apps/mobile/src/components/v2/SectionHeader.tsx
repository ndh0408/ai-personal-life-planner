import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../../theme/v2';
import { Text } from './Text';

interface Props {
  kicker?: string;
  title: string;
  /** Optional small action shown right-aligned, e.g. "View all". */
  action?: { label: string; onPress: () => void };
}

/**
 * The section frame used at the top of every list / row inside a screen.
 * Two-line: small uppercase kicker + soft title. Optional right action.
 */
export function SectionHeader({ kicker, title, action }: Props) {
  const t = useTheme();
  return (
    <View>
      {kicker ? (
        <Text variant="kicker" tone="tertiary" style={{ marginBottom: t.space['1'] }}>
          {kicker}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: t.space['3'],
        }}
      >
        <Text variant="titleL" tone="primary" style={{ flex: 1 }} numberOfLines={1}>
          {title}
        </Text>
        {action ? (
          <Pressable onPress={action.onPress} hitSlop={8}>
            <Text variant="caption" tone="link">
              {action.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
