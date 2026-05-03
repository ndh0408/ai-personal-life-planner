import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../../theme/v2';
import { Surface } from './Surface';
import { Text } from './Text';
import { haptic } from '../../platform/haptics';

export type InsightTone = 'neutral' | 'celebrate' | 'concern' | 'invite';

interface Props {
  tone?: InsightTone;
  kicker?: string;
  title: string;
  body: string;
  /** "Why this?" provenance count — shown as a small chip when > 0. */
  evidenceCount?: number;
  onWhyPress?: () => void;
  primaryAction?: { label: string; onPress: () => void };
  dismiss?: () => void;
}

/**
 * The proactive AI insight card. Tone selects the accent stripe; provenance
 * count + "Why this?" link is the explainability hook. Calm-luxury: never
 * red, never urgent — even a "concern" stays muted.
 */
export function Insight({
  tone = 'neutral',
  kicker,
  title,
  body,
  evidenceCount = 0,
  onWhyPress,
  primaryAction,
  dismiss,
}: Props) {
  const t = useTheme();

  const accent = (() => {
    switch (tone) {
      case 'celebrate':
        return t.color.status.success.fg;
      case 'concern':
        return t.color.status.warning.fg;
      case 'invite':
        return t.color.accent.base;
      case 'neutral':
      default:
        return t.color.text.tertiary;
    }
  })();

  return (
    <Surface level="surface" radius="xl" bordered>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 4, backgroundColor: accent, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 }} />
        <View style={{ flex: 1, padding: t.space['5'], gap: t.space['2'] }}>
          {kicker ? (
            <Text variant="kicker" style={{ color: accent }}>
              {kicker}
            </Text>
          ) : null}
          <Text variant="titleM" tone="primary">
            {title}
          </Text>
          <Text variant="bodyM" tone="secondary" style={{ lineHeight: 22 }}>
            {body}
          </Text>
          {(evidenceCount > 0 || primaryAction || dismiss) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: t.space['2'], gap: t.space['3'] }}>
              {evidenceCount > 0 && onWhyPress ? (
                <Pressable
                  onPress={() => {
                    haptic('soft');
                    onWhyPress();
                  }}
                  hitSlop={8}
                >
                  <View
                    style={{
                      paddingHorizontal: t.space['3'],
                      paddingVertical: t.space['1'],
                      borderRadius: t.radius.pill,
                      borderWidth: 1,
                      borderColor: t.color.border.base,
                    }}
                  >
                    <Text variant="caption" tone="secondary">
                      Why this · {evidenceCount}
                    </Text>
                  </View>
                </Pressable>
              ) : null}
              <View style={{ flex: 1 }} />
              {dismiss ? (
                <Pressable onPress={dismiss} hitSlop={8}>
                  <Text variant="caption" tone="tertiary">
                    Dismiss
                  </Text>
                </Pressable>
              ) : null}
              {primaryAction ? (
                <Pressable
                  onPress={() => {
                    haptic('confirm');
                    primaryAction.onPress();
                  }}
                  hitSlop={8}
                >
                  <Text variant="caption" tone="link">
                    {primaryAction.label}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      </View>
    </Surface>
  );
}
