import React from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Card, Button, Loading, ErrorView, Badge } from '../../components/ui';
import { voiceCompanionApi } from '../../services/api/voice-companion.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { QUERY_KEYS } from '../../constants';
import type { SuggestedActionDto, SuggestedActionTypeDto } from '@planner/shared';

const LOW = 0.5;

export function SuggestedActionsReviewScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const messageFor = useErrorMessage();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: QUERY_KEYS.pendingActions,
    queryFn: voiceCompanionApi.pendingActions,
  });

  const confirmMut = useMutation({
    mutationFn: (id: string) => voiceCompanionApi.confirmAction(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.pendingActions }),
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });
  const rejectMut = useMutation({
    mutationFn: (id: string) => voiceCompanionApi.rejectAction(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.pendingActions }),
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });

  if (q.isLoading) return <Loading />;
  if (q.isError) {
    return <ErrorView message={messageFor(q.error)} onRetry={() => q.refetch()} />;
  }

  const items: SuggestedActionDto[] = q.data ?? [];

  return (
    <Screen scroll>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>
          {t('settings.suggestedActions.title')}
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md }}>
          {t('settings.suggestedActions.subtitle')}
        </Text>

        {items.length === 0 ? (
          <Card>
            <Text style={{ color: colors.textMuted }}>
              {t('settings.suggestedActions.empty')}
            </Text>
          </Card>
        ) : (
          items.map((a) => (
            <Card key={a.id} style={{ marginBottom: spacing.md }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing.xs,
                }}
              >
                <Badge tone="info">
                  {t(`settings.suggestedActions.type.${a.type as SuggestedActionTypeDto}`)}
                </Badge>
                {a.confidence !== null && a.confidence < LOW ? (
                  <Badge tone="danger">{t('settings.suggestedActions.low')}</Badge>
                ) : null}
              </View>
              <Text style={{ color: colors.text, fontWeight: '600' }}>{a.title}</Text>
              <Text style={{ color: colors.textMuted, marginTop: spacing.xs }} numberOfLines={3}>
                {JSON.stringify(a.payload)}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.md }}>
                <Button
                  title={t('settings.suggestedActions.confirm')}
                  onPress={() => confirmMut.mutate(a.id)}
                  loading={confirmMut.isPending && confirmMut.variables === a.id}
                />
                <Button
                  title={t('settings.suggestedActions.reject')}
                  variant="ghost"
                  onPress={() => rejectMut.mutate(a.id)}
                />
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
