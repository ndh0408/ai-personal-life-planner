import React from 'react';
import { View, type ViewProps, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

type Props = ViewProps & {
  padded?: boolean;
  elevated?: boolean;
  style?: ViewStyle;
};

export function Card({ padded = true, elevated = false, style, children, ...rest }: Props) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: elevated ? colors.bgElevated : colors.surface,
          borderRadius: radius.lg,
          padding: padded ? spacing.lg : 0,
          borderWidth: elevated ? 0 : 1,
          borderColor: colors.border,
          shadowColor: '#000',
          shadowOpacity: elevated ? 0.06 : 0,
          shadowRadius: elevated ? 8 : 0,
          shadowOffset: { width: 0, height: 4 },
          elevation: elevated ? 2 : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
