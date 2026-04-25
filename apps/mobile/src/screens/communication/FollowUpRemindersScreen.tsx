import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme';
import { Screen, Card, Button, Loading, Chip, Badge } from '../../components/ui';
import { communicationApi } from '../../services/api/communication.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { QUERY_KEYS } from '../../constants';
import type { RootStackParamList } from '../../navigation/types';

type Tab = 'email' | 'message';

export function FollowUpRemindersScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const messageFor = useErrorMessage();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('email');

  const emailQ = useQuery({
    queryKey: QUERY_KEYS.emailReminders,
    queryFn: communicationApi.listEmailReminders,
    enabled: tab === 'email',
  });
  const msgQ = useQuery({
    queryKey: QUERY_KEYS.messageReminders,
    queryFn: communicationApi.listMessageReminders,
    enabled: tab === 'message',
  });

  const markDone = useMutation<unknown, unknown, { kind: Tab; id: string }>({
    mutationFn: async ({ kind, id }) => {
      if (kind === 'email') {
        await communicationApi.patchEmailReminderStatus(id, 'DONE');
      } else {
        await communicationApi.patchMessageReminderStatus(id, 'DONE');
      }
    },
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: tab === 'email' ? QUERY_KEYS.emailReminders : QUERY_KEYS.messageReminders,
      }),
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });

  const remove = useMutation<unknown, unknown, { kind: Tab; id: string }>({
    mutationFn: async ({ kind, id }) => {
      if (kind === 'email') {
        await communicationApi.deleteEmailReminder(id);
      } else {
        await communicationApi.deleteMessageReminder(id);
      }
    },
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: tab === 'email' ? QUERY_KEYS.emailReminders : QUERY_KEYS.messageReminders,
      }),
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });

  const loading =
    (tab === 'email' && emailQ.isLoading) || (tab === 'message' && msgQ.isLoading);
  const items = tab === 'email' ? emailQ.data ?? [] : msgQ.data ?? [];

  return (
    <Screen scroll>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: spacing.md }}>
          {t('settings.communication.followUps.title')}
        </Text>

        <View style={{ flexDirection: 'row', gap: 6, marginBottom: spacing.md }}>
          <Chip
            label={t('settings.communication.followUps.tab.email')}
            selected={tab === 'email'}
            onPress={() => setTab('email')}
          />
          <Chip
            label={t('settings.communication.followUps.tab.message')}
            selected={tab === 'message'}
            onPress={() => setTab('message')}
          />
        </View>

        {tab === 'message' ? (
          <Button
            title={t('settings.communication.followUps.addManual')}
            onPress={() => nav.navigate('AddMessageReminder')}
            style={{ marginBottom: spacing.md }}
          />
        ) : null}

        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <Card>
            <Text style={{ color: colors.textMuted }}>
              {t('settings.communication.followUps.empty')}
            </Text>
          </Card>
        ) : (
          items.map((it) => (
            <Card key={it.id} style={{ marginBottom: spacing.md }}>
              <View
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={1}>
                  {it.title}
                </Text>
                <Badge tone={it.status === 'DONE' ? 'success' : 'info'}>{it.status}</Badge>
              </View>
              {'contactName' in it && it.contactName ? (
                <Text style={{ color: colors.textMuted, marginTop: 2 }}>
                  {it.contactName} · {it.platform ?? '—'}
                </Text>
              ) : null}
              <Text style={{ color: colors.textMuted, marginTop: 2 }}>
                {new Date(it.remindAt).toLocaleString()}
              </Text>
              {it.note ? (
                <Text style={{ color: colors.text, marginTop: spacing.sm }}>{it.note}</Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 6, marginTop: spacing.md }}>
                {it.status !== 'DONE' ? (
                  <Button
                    title={t('settings.communication.followUps.done')}
                    variant="secondary"
                    onPress={() => markDone.mutate({ kind: tab, id: it.id })}
                  />
                ) : null}
                <Button
                  title={t('common.delete')}
                  variant="ghost"
                  onPress={() => remove.mutate({ kind: tab, id: it.id })}
                />
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
