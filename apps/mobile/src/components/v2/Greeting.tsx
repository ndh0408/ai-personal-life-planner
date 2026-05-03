import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme/v2';
import { Text } from './Text';

interface Props {
  name: string | null;
  /** Override the time-derived greeting; useful for testing. */
  hourOverride?: number;
  locale?: 'vi' | 'en';
}

const FALLBACK = { vi: 'bạn', en: 'friend' };

/**
 * Time-aware greeting. Uses Intl-free local hour (Date.getHours uses device
 * tz, which is what we want — the user is *here*, not in UTC).
 */
export function Greeting({ name, hourOverride, locale = 'vi' }: Props) {
  const t = useTheme();
  const hour = hourOverride ?? new Date().getHours();
  const phrase = greetingFor(hour, locale);
  const subject = name ?? FALLBACK[locale];
  return (
    <View>
      <Text variant="kicker" tone="tertiary">
        {locale === 'vi' ? 'BÂY GIỜ' : 'NOW'}
      </Text>
      <Text variant="displayM" tone="primary" style={{ marginTop: t.space['1'] }}>
        {phrase}, {subject}
      </Text>
    </View>
  );
}

function greetingFor(h: number, locale: 'vi' | 'en'): string {
  if (locale === 'vi') {
    if (h < 5) return 'Khuya rồi';
    if (h < 11) return 'Chào buổi sáng';
    if (h < 14) return 'Chào buổi trưa';
    if (h < 18) return 'Chào buổi chiều';
    if (h < 22) return 'Chào buổi tối';
    return 'Khuya rồi';
  }
  if (h < 5) return 'Late night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Late night';
}
