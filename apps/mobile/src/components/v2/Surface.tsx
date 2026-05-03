import React from 'react';
import { View, type ViewProps, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/v2';
import { elevationStyle } from '../../theme/v2/elevation';
import type { ElevationLevel } from '@lifeos/design-tokens';

interface Props extends ViewProps {
  level?: keyof ReturnType<typeof useTheme>['color']['bg'];
  /** Hairline border. Default true for `surface` and above; false for `canvas`. */
  bordered?: boolean;
  elevation?: ElevationLevel;
  radius?: keyof ReturnType<typeof useTheme>['radius'];
  /** Inner padding using space tokens. */
  pad?: keyof ReturnType<typeof useTheme>['space'];
}

/**
 * Foundational container — picks bg from semantic tokens, optional hairline,
 * optional elevation. Components NEVER set raw colors; they nest a Surface.
 */
export function Surface({
  level = 'surface',
  bordered,
  elevation,
  radius = 'lg',
  pad,
  style,
  children,
  ...rest
}: Props) {
  const t = useTheme();
  const bg = t.color.bg[level];
  const showBorder = bordered ?? level !== 'canvas';

  const composed: ViewStyle = {
    backgroundColor: bg,
    borderRadius: t.radius[radius],
    borderWidth: showBorder ? 1 : 0,
    borderColor: t.color.border.hairline,
    padding: pad !== undefined ? t.space[pad] : 0,
    ...(elevation ? elevationStyle(elevation) : null),
  };

  return (
    <View style={[composed, style]} {...rest}>
      {children}
    </View>
  );
}
