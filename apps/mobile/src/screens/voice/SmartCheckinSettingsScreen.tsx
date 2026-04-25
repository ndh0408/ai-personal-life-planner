import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Card, Button, Loading, ErrorView, Input } from '../../components/ui';
import { voiceCompanionApi } from '../../services/api/voice-companion.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { QUERY_KEYS } from '../../constants';
import type {
  SmartCheckinSettingsDto,
  UpdateSmartCheckinSettingsInput,
} from '@planner/shared';

type Key = keyof Omit<
  SmartCheckinSettingsDto,
  'updatedAt' | 'morningTime' | 'eveningTime' | 'sleepReminderTime'
>;

const ROWS: Array<{ key: Key; i18nKey: string }> = [
  { key: 'morningCheckinEnabled', i18nKey: 'morning' },
  { key: 'mealCheckinEnabled', i18nKey: 'meal' },
  { key: 'eveningReviewEnabled', i18nKey: 'evening' },
  { key: 'sleepReminderEnabled', i18nKey: 'sleep' },
  { key: 'financeCheckinEnabled', i18nKey: 'finance' },
];

export function SmartCheckinSettingsScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const messageFor = useErrorMessage();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: QUERY_KEYS.smartCheckinSettings,
    queryFn: voiceCompanionApi.getCheckinSettings,
  });
  const [draft, setDraft] = useState<SmartCheckinSettingsDto | null>(null);
  useEffect(() => {
    if (q.data) setDraft(q.data);
  }, [q.data]);

  const mut = useMutation({
    mutationFn: (input: UpdateSmartCheckinSettingsInput) =>
      voiceCompanionApi.updateCheckinSettings(input),
    onSuccess: (next) => {
      qc.setQueryData<SmartCheckinSettingsDto>(QUERY_KEYS.smartCheckinSettings, next);
      setDraft(next);
    },
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });

  if (q.isLoading || !draft) return <Loading />;
  if (q.isError) {
    return <ErrorView message={messageFor(q.error)} onRetry={() => q.refetch()} />;
  }

  const onToggle = (key: Key, value: boolean) => {
    setDraft({ ...draft, [key]: value });
    mut.mutate({ [key]: value } as UpdateSmartCheckinSettingsInput);
  };

  const onTimeBlur = (
    key: 'morningTime' | 'eveningTime' | 'sleepReminderTime',
    value: string,
  ) => {
    setDraft({ ...draft, [key]: value });
    mut.mutate({ [key]: value } as UpdateSmartCheckinSettingsInput);
  };

  return (
    <Screen scroll>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>
          {t('settings.checkins.title')}
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md }}>
          {t('settings.checkins.subtitle')}
        </Text>

        <Card style={{ marginBottom: spacing.md }}>
          {ROWS.map((r, idx) => (
            <View
              key={r.key}
              style={{
                paddingVertical: spacing.sm,
                borderBottomWidth: idx === ROWS.length - 1 ? 0 : 1,
                borderBottomColor: colors.border,
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
                  {t(`settings.checkins.${r.i18nKey}.label`)}
                </Text>
                <Switch
                  value={Boolean(draft[r.key])}
                  onValueChange={(v) => onToggle(r.key, v)}
                  disabled={mut.isPending}
                />
              </View>
              <Text style={{ color: colors.textMuted, marginTop: 4 }}>
                {t(`settings.checkins.${r.i18nKey}.hint`)}
              </Text>
            </View>
          ))}
        </Card>

        <Card style={{ marginBottom: spacing.md, gap: spacing.md }}>
          <Input
            label={t('settings.checkins.morningTime')}
            value={draft.morningTime}
            onChangeText={(v) => setDraft({ ...draft, morningTime: v })}
            onBlur={() => onTimeBlur('morningTime', draft.morningTime)}
            autoCapitalize="none"
          />
          <Input
            label={t('settings.checkins.eveningTime')}
            value={draft.eveningTime}
            onChangeText={(v) => setDraft({ ...draft, eveningTime: v })}
            onBlur={() => onTimeBlur('eveningTime', draft.eveningTime)}
            autoCapitalize="none"
          />
          <Input
            label={t('settings.checkins.sleepReminderTime')}
            value={draft.sleepReminderTime}
            onChangeText={(v) => setDraft({ ...draft, sleepReminderTime: v })}
            onBlur={() => onTimeBlur('sleepReminderTime', draft.sleepReminderTime)}
            autoCapitalize="none"
          />
        </Card>

        <Button title={t('settings.privacy.save')} variant="ghost" onPress={() => undefined} />
      </ScrollView>
    </Screen>
  );
}
