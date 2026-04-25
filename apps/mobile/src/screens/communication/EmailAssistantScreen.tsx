import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Card, Button, Loading, ErrorView, Badge, Chip } from '../../components/ui';
import { communicationApi } from '../../services/api/communication.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { QUERY_KEYS } from '../../constants';
import type { EmailItemDto } from '@planner/shared';

type FilterKey = 'important' | 'needsReply' | 'deadline' | 'bills' | 'work';

export function EmailAssistantScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const messageFor = useErrorMessage();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterKey | null>(null);

  const params = useMemo(() => {
    switch (filter) {
      case 'important':
        return { isImportant: true };
      case 'needsReply':
        return { needsReply: true };
      case 'deadline':
        return { hasDeadline: true };
      case 'bills':
        return { category: 'BILL' as const };
      case 'work':
        return { category: 'WORK' as const };
      default:
        return {};
    }
  }, [filter]);

  const q = useQuery({
    queryKey: QUERY_KEYS.emails(params),
    queryFn: () => communicationApi.listEmails(params),
  });

  const sync = useMutation({
    mutationFn: communicationApi.syncEmails,
    onSuccess: (r) => {
      if (r.notImplemented) {
        Alert.alert(
          t('settings.communication.email.title'),
          t('settings.communication.email.syncStub'),
        );
      } else {
        qc.invalidateQueries({ queryKey: ['communication', 'emails'] });
      }
    },
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });

  const analyze = useMutation({
    mutationFn: (id: string) => communicationApi.analyzeEmail(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['communication', 'emails'] }),
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });

  const markDone = useMutation({
    mutationFn: (id: string) => communicationApi.patchEmailStatus(id, { isRead: true, needsReply: false }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['communication', 'emails'] }),
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });

  if (q.isLoading) return <Loading />;
  if (q.isError) {
    return <ErrorView message={messageFor(q.error)} onRetry={() => q.refetch()} />;
  }

  const items: EmailItemDto[] = q.data?.items ?? [];

  return (
    <Screen scroll>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: spacing.md }}>
          {t('settings.communication.email.title')}
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md }}>
          {(['important', 'needsReply', 'deadline', 'bills', 'work'] as FilterKey[]).map((k) => (
            <Chip
              key={k}
              label={t(`settings.communication.email.filter${k.charAt(0).toUpperCase() + k.slice(1)}`)}
              selected={filter === k}
              onPress={() => setFilter(filter === k ? null : k)}
            />
          ))}
        </View>

        <Button
          title={t('settings.communication.email.syncCta')}
          variant="secondary"
          loading={sync.isPending}
          onPress={() => sync.mutate()}
          style={{ marginBottom: spacing.md }}
        />

        {items.length === 0 ? (
          <Card>
            <Text style={{ color: colors.textMuted }}>
              {t('settings.communication.email.noResults')}
            </Text>
          </Card>
        ) : (
          items.map((e) => (
            <Card key={e.id} style={{ marginBottom: spacing.md }}>
              <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={1}>
                {e.subject}
              </Text>
              <Text style={{ color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>
                {e.fromName ?? ''} {e.fromEmail ? `<${e.fromEmail}>` : ''}
              </Text>
              {e.snippet ? (
                <Text style={{ color: colors.text, marginTop: spacing.xs }} numberOfLines={2}>
                  {e.snippet}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: spacing.sm }}>
                {e.isImportant ? <Badge tone="primary">{t('settings.communication.email.filterImportant')}</Badge> : null}
                {e.needsReply ? <Badge tone="info">{t('settings.communication.email.filterNeedsReply')}</Badge> : null}
                {e.hasDeadline ? <Badge tone="danger">{t('settings.communication.email.filterDeadline')}</Badge> : null}
                {e.category ? <Badge tone="info">{e.category}</Badge> : null}
              </View>
              {e.aiSummary ? (
                <Text style={{ color: colors.textMuted, marginTop: spacing.sm, fontStyle: 'italic' }}>
                  {e.aiSummary}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: spacing.md }}>
                <Button
                  title={t('settings.communication.email.actions.analyze')}
                  variant="secondary"
                  loading={analyze.isPending && analyze.variables === e.id}
                  onPress={() => analyze.mutate(e.id)}
                />
                <Button
                  title={t('settings.communication.email.actions.markDone')}
                  variant="ghost"
                  onPress={() => markDone.mutate(e.id)}
                />
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
