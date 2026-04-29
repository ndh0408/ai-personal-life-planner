/**
 * Single icon entry point. Wraps Ionicons (best coverage of UI affordances
 * we need: home, calendar, wallet, sparkles, settings, food, plus, check,
 * trash, etc.). Centralising here means we can swap to Lucide / Material
 * later by editing one file.
 */
import React from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors } from '../../theme';

export type IconName =
  // Tabs
  | 'home'
  | 'home-outline'
  | 'calendar'
  | 'calendar-outline'
  | 'wallet'
  | 'wallet-outline'
  | 'sparkles'
  | 'sparkles-outline'
  | 'settings'
  | 'settings-outline'
  // Quick actions / kinds
  | 'create-outline' // capture
  | 'cash-outline' // expense
  | 'trending-up-outline' // income
  | 'checkmark-circle-outline' // task / done
  | 'restaurant-outline' // meal
  | 'moon-outline' // sleep
  | 'happy-outline' // mood
  | 'pulse-outline' // health
  | 'fitness-outline'
  // Misc
  | 'add'
  | 'add-circle'
  | 'close'
  | 'trash-outline'
  | 'chevron-forward'
  | 'chevron-back'
  | 'arrow-up-circle'
  | 'arrow-down-circle'
  | 'arrow-back'
  | 'flash-outline'
  | 'time-outline'
  | 'wifi'
  | 'cloud-offline-outline'
  | 'eye-outline'
  | 'eye-off-outline'
  | 'log-out-outline'
  | 'language-outline'
  | 'shield-checkmark-outline'
  | 'mic-outline'
  | 'send'
  | 'chatbubbles-outline'
  | 'pricetag-outline'
  // Round 31 — alerts, navigation, AI
  | 'alert-circle-outline'
  | 'warning-outline'
  | 'information-circle-outline'
  | 'help-circle-outline'
  | 'lock-closed-outline'
  | 'eye-off'
  | 'refresh-outline'
  | 'open-outline'
  | 'play-outline'
  | 'stop-outline'
  | 'thumbs-up-outline'
  | 'thumbs-down-outline'
  | 'arrow-forward-outline'
  | 'bookmark-outline'
  | 'bulb-outline';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 22, color = colors.text.primary }: Props) {
  return <Ionicons name={name} size={size} color={color} />;
}
