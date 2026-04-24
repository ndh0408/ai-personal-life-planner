import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../theme';
import { Card } from './Card';
import { Badge } from './Badge';

type Props = {
  title: string;
  content: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  type: string;
  onDismiss?: () => void;
  onApply?: () => void;
  dismissLabel?: string;
  applyLabel?: string;
};

const PRIORITY_TONE: Record<Props['priority'], 'neutral' | 'warning' | 'danger'> = {
  LOW: 'neutral',
  MEDIUM: 'warning',
  HIGH: 'danger',
};

/**
 * The core surface for proactive AI nudges.
 * Two optional actions: dismiss (secondary) and apply (primary).
 */
export function RecommendationCard({
  title,
  content,
  priority,
  type,
  onDismiss,
  onApply,
  dismissLabel,
  applyLabel,
}: Props) {
  const { colors, spacing, radius, typography } = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
        <Badge tone="neutral">{type}</Badge>
        <Badge tone={PRIORITY_TONE[priority]}>{priority}</Badge>
      </View>
      <Text style={[typography.bodyStrong, { color: colors.text }]}>{title}</Text>
      <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.xs }]}>
        {content}
      </Text>
      {(onDismiss || onApply) && (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          {onDismiss ? (
            <TouchableOpacity
              onPress={onDismiss}
              style={{
                flex: 1,
                paddingVertical: spacing.sm,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
              }}
            >
              <Text style={[typography.bodyStrong, { color: colors.textMuted }]}>
                {dismissLabel ?? 'Dismiss'}
              </Text>
            </TouchableOpacity>
          ) : null}
          {onApply ? (
            <TouchableOpacity
              onPress={onApply}
              style={{
                flex: 1,
                paddingVertical: spacing.sm,
                borderRadius: radius.md,
                backgroundColor: colors.primary,
                alignItems: 'center',
              }}
            >
              <Text style={[typography.bodyStrong, { color: colors.textInverse }]}>
                {applyLabel ?? 'Apply'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </Card>
  );
}
