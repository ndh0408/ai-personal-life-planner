import React from 'react';
import { ScrollView, Text } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Card, Button, Loading, ErrorView } from '../../components/ui';
import { SmartNudgeCard } from '../../components/context/SmartNudgeCard';
import { contextApi } from '../../services/api/context.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { QUERY_KEYS } from '../../constants';

export function ContextInferencesScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const messageFor = useErrorMessage();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: QUERY_KEYS.contextToday,
    queryFn: () => contextApi.today(),
  });

  const runMut = useMutation({
    mutationFn: () => contextApi.run({}),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.contextToday }),
  });

  if (q.isLoading) return <Loading />;
  if (q.isError) {
    return <ErrorView message={messageFor(q.error)} onRetry={() => q.refetch()} />;
  }

  const items = (q.data?.inferences ?? []).filter(
    (i) => i.status !== 'DISMISSED' && i.status !== 'APPLIED',
  );

  return (
    <Screen scroll>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>
          {t('settings.context.title')}
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md }}>
          {t('settings.context.subtitle')}
        </Text>

        <Button
          title="↻"
          variant="ghost"
          loading={runMut.isPending}
          onPress={() => runMut.mutate()}
          style={{ alignSelf: 'flex-end', marginBottom: spacing.sm }}
        />

        {items.length === 0 ? (
          <Card>
            <Text style={{ color: colors.textMuted }}>
              {t('settings.context.noNudges')}
            </Text>
          </Card>
        ) : (
          items.map((inf) => <SmartNudgeCard key={inf.id} inference={inf} />)
        )}
      </ScrollView>
    </Screen>
  );
}
