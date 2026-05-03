import { Platform, type TextStyle } from 'react-native';
import { typography, fontFamily, type TypoVariant, type FontStyle } from '@lifeos/design-tokens';

export type TextVariant = TypoVariant;

/** Resolve a token family ("display"/"text"/"mono") to the platform font name. */
export function resolveFontFamily(family: FontStyle['family']): string {
  const map = fontFamily[family];
  return Platform.select({ ios: map.ios, android: map.android, default: map.android })!;
}

/**
 * Convert a typography token into an RN TextStyle. trackingEm is converted
 * to absolute letterSpacing (RN does not accept em).
 */
export function makeTextStyle(variant: TextVariant): TextStyle {
  const t = typography[variant];
  return {
    fontFamily: resolveFontFamily(t.family),
    fontSize: t.size,
    lineHeight: t.lineHeight,
    fontWeight: t.weight,
    letterSpacing: t.trackingEm * t.size,
  };
}
