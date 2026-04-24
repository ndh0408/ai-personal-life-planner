import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { Badge } from '../ui/Badge';
import { formatTimeOfDay } from '../../utils/format';

type Props = {
  startTime: string | Date;
  endTime: string | Date;
  title: string;
  description?: string | null;
  type: string;
  status?: 'PENDING' | 'COMPLETED' | 'SKIPPED' | 'DELAYED';
  onPress?: () => void;
  isLast?: boolean;
};

const TYPE_TONE: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'neutral'> = {
  WORK: 'primary',
  STUDY: 'info',
  EXERCISE: 'success',
  MEAL: 'warning',
  REST: 'neutral',
  SLEEP: 'neutral',
  TASK: 'primary',
  TRAVEL: 'info',
  CUSTOM: 'neutral',
};

export function TimelineItem({
  startTime,
  endTime,
  title,
  description,
  type,
  status = 'PENDING',
  onPress,
  isLast,
}: Props) {
  const { colors, spacing, radius } = useTheme();
  const isDone = status === 'COMPLETED';

  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row' }}>
      <View style={{ alignItems: 'center', width: 64 }}>
        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>
          {formatTimeOfDay(startTime)}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
          {formatTimeOfDay(endTime)}
        </Text>
      </View>
      <View style={{ alignItems: 'center', marginRight: spacing.md }}>
        <View
          style={{
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: isDone ? colors.success : colors.primary,
            marginTop: 4,
          }}
        />
        {!isLast ? (
          <View style={{ width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 4 }} />
        ) : null}
      </View>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          padding: spacing.md,
          marginBottom: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: isDone ? 0.7 : 1,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text
            style={{
              flex: 1,
              color: colors.text,
              fontSize: 15,
              fontWeight: '600',
              textDecorationLine: isDone ? 'line-through' : 'none',
            }}
          >
            {title}
          </Text>
          <Badge tone={TYPE_TONE[type] ?? 'neutral'}>{type}</Badge>
        </View>
        {description ? (
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>{description}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}
