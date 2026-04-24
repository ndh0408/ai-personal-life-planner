import React from 'react';
import { View, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Card, Badge, ProgressCard, Loading, ErrorView, EmptyState } from '../../components/ui';
import { goalsApi } from '../../services/api/goals.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { formatDateByLocale } from '../../utils/format';

export function PersonalGoalsScreen() {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const translateError = useErrorMessage();
  const q = useQuery({ queryKey: ['goals'], queryFn: () => goalsApi.list() });

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorView message={translateError(q.error)} onRetry={() => q.refetch()} />;
  const items = q.data ?? [];

  return (
    <Screen scroll>
      <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.lg }]}>
        {t('goals.title')}
      </Text>
      {items.length === 0 ? (
        <EmptyState title={t('goals.empty.title')} description={t('goals.empty.description')} />
      ) : (
        <View style={{ gap: spacing.md }}>
          {items.map((g) => (
            <View key={g.id} style={{ gap: spacing.sm }}>
              {g.targetValue && g.currentValue !== null ? (
                <ProgressCard
                  title={g.title}
                  current={g.currentValue}
                  target={g.targetValue}
                  currentLabel={`${g.currentValue} / ${g.targetValue} ${g.unit ?? ''}`.trim()}
                  subtitle={
                    g.deadline
                      ? `${t('goals.deadline')}: ${formatDateByLocale(g.deadline, { weekday: undefined })}`
                      : undefined
                  }
                />
              ) : (
                <Card>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs }}>
                    <Badge tone="neutral">{g.category}</Badge>
                    <Badge tone={g.priority === 'HIGH' ? 'danger' : 'neutral'}>{g.priority}</Badge>
                  </View>
                  <Text style={[typography.bodyStrong, { color: colors.text }]}>{g.title}</Text>
                  {g.description ? (
                    <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
                      {g.description}
                    </Text>
                  ) : null}
                </Card>
              )}
              {g.milestones.length > 0 ? (
                <Card>
                  <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>
                    {t('goals.milestones')}
                  </Text>
                  {g.milestones.map((m) => (
                    <View key={m.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs }}>
                      <Text style={{ color: m.status === 'COMPLETED' ? colors.textMuted : colors.text, textDecorationLine: m.status === 'COMPLETED' ? 'line-through' : 'none' }}>
                        {m.title}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textMuted }]}>{m.status}</Text>
                    </View>
                  ))}
                </Card>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}
