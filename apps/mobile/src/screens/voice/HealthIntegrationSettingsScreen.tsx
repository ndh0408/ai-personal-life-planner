import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Card, Loading, ErrorView, Chip } from '../../components/ui';
import { voiceCompanionApi } from '../../services/api/voice-companion.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { QUERY_KEYS } from '../../constants';
import type {
  HealthIntegrationDto,
  HealthIntegrationProviderDto,
  UpdateHealthIntegrationInput,
} from '@planner/shared';

type Key = keyof Pick<
  HealthIntegrationDto,
  'readSleep' | 'readSteps' | 'readExercise' | 'readHeartRate' | 'readWeight'
>;

const ROWS: Key[] = ['readSleep', 'readSteps', 'readExercise', 'readHeartRate', 'readWeight'];

export function HealthIntegrationSettingsScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const messageFor = useErrorMessage();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: QUERY_KEYS.healthIntegration,
    queryFn: voiceCompanionApi.getHealthIntegration,
  });
  const [draft, setDraft] = useState<HealthIntegrationDto | null>(null);
  useEffect(() => {
    if (q.data) setDraft(q.data);
  }, [q.data]);

  const mut = useMutation({
    mutationFn: (input: UpdateHealthIntegrationInput) =>
      voiceCompanionApi.updateHealthIntegration(input),
    onSuccess: (next) => {
      qc.setQueryData<HealthIntegrationDto>(QUERY_KEYS.healthIntegration, next);
      setDraft(next);
    },
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });

  if (q.isLoading || !draft) return <Loading />;
  if (q.isError) {
    return <ErrorView message={messageFor(q.error)} onRetry={() => q.refetch()} />;
  }

  const setProvider = (provider: HealthIntegrationProviderDto) => {
    setDraft({ ...draft, provider });
    mut.mutate({ provider });
  };

  return (
    <Screen scroll>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>
          {t('settings.healthIntegration.title')}
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md }}>
          {t('settings.healthIntegration.subtitle')}
        </Text>
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={{ color: colors.textMuted }}>
            {t('settings.healthIntegration.notWired')}
          </Text>
        </Card>

        <Text
          style={{
            color: colors.textMuted,
            textTransform: 'uppercase',
            fontSize: 12,
            fontWeight: '700',
            marginBottom: spacing.xs,
          }}
        >
          {t('settings.healthIntegration.provider')}
        </Text>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: spacing.md, flexWrap: 'wrap' }}>
          <Chip
            label={t('settings.healthIntegration.providerNone')}
            selected={draft.provider === 'NONE'}
            onPress={() => setProvider('NONE')}
          />
          <Chip
            label={t('settings.healthIntegration.providerHealthkit')}
            selected={draft.provider === 'HEALTHKIT'}
            onPress={() => setProvider('HEALTHKIT')}
          />
          <Chip
            label={t('settings.healthIntegration.providerHealthConnect')}
            selected={draft.provider === 'HEALTH_CONNECT'}
            onPress={() => setProvider('HEALTH_CONNECT')}
          />
        </View>

        <Card>
          {ROWS.map((k, idx) => (
            <View
              key={k}
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
                  {t(`settings.healthIntegration.${k}.label`)}
                </Text>
                <Switch
                  value={Boolean(draft[k])}
                  onValueChange={(v) => {
                    setDraft({ ...draft, [k]: v });
                    mut.mutate({ [k]: v } as UpdateHealthIntegrationInput);
                  }}
                  disabled={draft.provider === 'NONE' || mut.isPending}
                />
              </View>
              <Text style={{ color: colors.textMuted, marginTop: 4 }}>
                {t(`settings.healthIntegration.${k}.hint`)}
              </Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </Screen>
  );
}
