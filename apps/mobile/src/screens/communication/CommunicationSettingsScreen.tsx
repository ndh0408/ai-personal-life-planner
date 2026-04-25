import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme';
import { Screen, Card, Button, Loading, ErrorView } from '../../components/ui';
import { communicationApi } from '../../services/api/communication.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { QUERY_KEYS } from '../../constants';
import type { RootStackParamList } from '../../navigation/types';
import type {
  CommunicationSettingsDto,
  UpdateCommunicationSettingsInput,
} from '@planner/shared';

type Key = keyof Omit<CommunicationSettingsDto, 'updatedAt'>;

const ROWS: Array<{ key: Key; section: 'email' | 'reminders' | 'memory' | 'android' }> = [
  { key: 'emailAssistantEnabled', section: 'email' },
  { key: 'emailMetadataSync', section: 'email' },
  { key: 'emailSnippetSync', section: 'email' },
  { key: 'emailFullContentAnalysis', section: 'email' },
  { key: 'followUpRemindersEnabled', section: 'reminders' },
  { key: 'messageReminderEnabled', section: 'reminders' },
  { key: 'aiMemoryEnabled', section: 'memory' },
  { key: 'androidNotificationImportEnabled', section: 'android' },
];

export function CommunicationSettingsScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const messageFor = useErrorMessage();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: QUERY_KEYS.communicationSettings,
    queryFn: communicationApi.getSettings,
  });
  const [draft, setDraft] = useState<CommunicationSettingsDto | null>(null);
  useEffect(() => {
    if (q.data) setDraft(q.data);
  }, [q.data]);

  const updateMut = useMutation({
    mutationFn: communicationApi.updateSettings,
    onSuccess: (next) => {
      qc.setQueryData<CommunicationSettingsDto>(QUERY_KEYS.communicationSettings, next);
      setDraft(next);
    },
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });

  if (q.isLoading || !draft) return <Loading />;
  if (q.isError) {
    return <ErrorView message={messageFor(q.error)} onRetry={() => q.refetch()} />;
  }

  // Snippet ladder mirror — disable downstream toggles client-side too.
  const enableSnippet = draft.emailMetadataSync;
  const enableFull = draft.emailMetadataSync && draft.emailSnippetSync;

  const onToggle = (key: Key, value: boolean) => {
    const payload: UpdateCommunicationSettingsInput = { [key]: value };
    // Cascade-down when turning OFF the parent of the snippet ladder.
    if (key === 'emailMetadataSync' && value === false) {
      payload.emailSnippetSync = false;
      payload.emailFullContentAnalysis = false;
    }
    if (key === 'emailSnippetSync' && value === false) {
      payload.emailFullContentAnalysis = false;
    }
    setDraft({ ...draft, ...payload });
    updateMut.mutate(payload);
  };

  const sections: Array<['email' | 'reminders' | 'memory' | 'android', string]> = [
    ['email', t('settings.communication.section.email')],
    ['reminders', t('settings.communication.section.reminders')],
    ['memory', t('settings.communication.section.memory')],
    ['android', t('settings.communication.section.android')],
  ];

  return (
    <Screen scroll>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>
          {t('settings.communication.title')}
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md }}>
          {t('settings.communication.subtitle')}
        </Text>
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>
            {t('settings.communication.promise')}
          </Text>
        </Card>

        {sections.map(([sec, label]) => (
          <View key={sec} style={{ marginBottom: spacing.md }}>
            <Text
              style={{
                color: colors.textMuted,
                textTransform: 'uppercase',
                fontSize: 12,
                fontWeight: '700',
                marginBottom: spacing.xs,
              }}
            >
              {label}
            </Text>
            <Card>
              {ROWS.filter((r) => r.section === sec).map((row, idx, arr) => {
                const disabled =
                  (row.key === 'emailSnippetSync' && !enableSnippet) ||
                  (row.key === 'emailFullContentAnalysis' && !enableFull);
                return (
                  <View
                    key={row.key}
                    style={{
                      paddingVertical: spacing.sm,
                      borderBottomWidth: idx === arr.length - 1 ? 0 : 1,
                      borderBottomColor: colors.border,
                      opacity: disabled ? 0.5 : 1,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: '600', flex: 1, paddingRight: 8 }}>
                        {t(`settings.communication.toggles.${row.key}.label`)}
                      </Text>
                      <Switch
                        value={Boolean(draft[row.key])}
                        onValueChange={(v) => onToggle(row.key, v)}
                        disabled={disabled || updateMut.isPending}
                      />
                    </View>
                    <Text style={{ color: colors.textMuted, marginTop: 4 }}>
                      {t(`settings.communication.toggles.${row.key}.hint`)}
                    </Text>
                  </View>
                );
              })}
            </Card>
          </View>
        ))}

        <View style={{ gap: spacing.sm }}>
          <Button
            title={t('settings.communication.accounts.title')}
            variant="secondary"
            onPress={() => nav.navigate('ConnectedAccounts')}
          />
          <Button
            title={t('settings.communication.email.title')}
            variant="secondary"
            onPress={() => nav.navigate('EmailAssistant')}
          />
          <Button
            title={t('settings.communication.followUps.title')}
            variant="secondary"
            onPress={() => nav.navigate('FollowUpReminders')}
          />
          <Button
            title={t('settings.communication.memory.title')}
            variant="secondary"
            onPress={() => nav.navigate('AICompanionMemory')}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
