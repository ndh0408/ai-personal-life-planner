import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme';
import { Screen, Card, Button, Loading, ErrorView } from '../../components/ui';
import {
  privacyApi,
  PRIVACY_POLICY_VERSION,
  type ConsentType,
} from '../../services/api/privacy.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { QUERY_KEYS } from '../../constants';
import type { RootStackParamList } from '../../navigation/types';
import type {
  PrivacySettingsDto,
  UpdatePrivacySettingsInput,
  UserConsentTypeDto,
} from '@planner/shared';

type ToggleKey = keyof Omit<PrivacySettingsDto, 'updatedAt'>;

/**
 * Each toggle is paired with a `consentType` so the privacy ledger records
 * grant/revoke per category. Toggles WITHOUT a matching consentType (the
 * master `personalizationEnabled`) write a PERSONALIZATION consent row.
 */
const TOGGLES: Array<{
  key: ToggleKey;
  consent: UserConsentTypeDto | null;
  section: 'personalization' | 'aiData' | 'deviceContext' | 'behavior';
}> = [
  { key: 'personalizationEnabled', consent: 'PERSONALIZATION', section: 'personalization' },
  { key: 'useScheduleForAI', consent: null, section: 'aiData' },
  { key: 'useTasksForAI', consent: null, section: 'aiData' },
  { key: 'useHabitsForAI', consent: null, section: 'aiData' },
  { key: 'useMealsForAI', consent: null, section: 'aiData' },
  { key: 'useFinanceForAI', consent: null, section: 'aiData' },
  { key: 'useHealthForAI', consent: null, section: 'aiData' },
  { key: 'useGoalsForAI', consent: null, section: 'aiData' },
  { key: 'useCalendarContext', consent: 'CALENDAR', section: 'deviceContext' },
  { key: 'useLocationContext', consent: 'LOCATION', section: 'deviceContext' },
  {
    key: 'useHealthFitnessContext',
    consent: 'HEALTH_FITNESS',
    section: 'deviceContext',
  },
  { key: 'useVoiceInput', consent: 'MICROPHONE', section: 'deviceContext' },
  { key: 'proactiveRecommendations', consent: null, section: 'behavior' },
  { key: 'anonymizedDiagnostics', consent: 'DIAGNOSTICS', section: 'behavior' },
];

/** Toggling these OFF shows a confirm — they're load-bearing for the
 *  product (finance/health) or destructive (personalisation master). */
const CONFIRM_OFF: ReadonlySet<ToggleKey> = new Set<ToggleKey>([
  'personalizationEnabled',
  'useFinanceForAI',
  'useHealthForAI',
]);

export function PrivacySettingsScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const messageFor = useErrorMessage();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const qc = useQueryClient();

  const settingsQ = useQuery({
    queryKey: QUERY_KEYS.privacySettings,
    queryFn: privacyApi.getSettings,
  });

  // Local copy so the user sees the new toggle state before round-trip.
  const [draft, setDraft] = useState<PrivacySettingsDto | null>(null);
  useEffect(() => {
    if (settingsQ.data) setDraft(settingsQ.data);
  }, [settingsQ.data]);

  const updateMut = useMutation({
    mutationFn: (input: UpdatePrivacySettingsInput) => privacyApi.updateSettings(input),
    onSuccess: (next) => {
      qc.setQueryData<PrivacySettingsDto>(QUERY_KEYS.privacySettings, next);
      setDraft(next);
    },
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });

  const consentMut = useMutation({
    mutationFn: privacyApi.recordConsent,
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.privacyConsents }),
    onError: () => undefined, // Best-effort — never block the toggle.
  });

  const applyToggle = (key: ToggleKey, consent: ConsentType | null, value: boolean) => {
    if (!draft) return;
    setDraft({ ...draft, [key]: value });
    updateMut.mutate({ [key]: value } as UpdatePrivacySettingsInput);
    if (consent) {
      consentMut.mutate({
        consentType: consent,
        granted: value,
        version: PRIVACY_POLICY_VERSION,
        metadata: { source: 'settings' },
      });
    }
  };

  const onToggle = (key: ToggleKey, consent: ConsentType | null, value: boolean) => {
    // Confirm before disabling load-bearing toggles — protects users from
    // an accidental tap that silently kills their AI personalisation.
    if (value === false && CONFIRM_OFF.has(key)) {
      Alert.alert(
        t(`settings.privacy.${key}.label`),
        t(`settings.privacy.${key}.hint`),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.confirm'),
            style: 'destructive',
            onPress: () => applyToggle(key, consent, false),
          },
        ],
      );
      return;
    }
    applyToggle(key, consent, value);
  };

  // ---- Export / Delete / Clear-memory mutations ----------------------------
  const exportMut = useMutation({
    mutationFn: privacyApi.exportData,
    onSuccess: () => Alert.alert(t('settings.privacy.actions.exportReady')),
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });

  const deleteMut = useMutation({
    mutationFn: privacyApi.deleteAccountRequest,
    onSuccess: (r) =>
      Alert.alert(
        t('settings.privacy.actions.deleteTitle'),
        t('settings.privacy.actions.deleteAck', {
          date: new Date(r.scheduledFor).toLocaleDateString(),
        }),
      ),
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });

  const onDeleteAccount = () =>
    Alert.alert(
      t('settings.privacy.actions.deleteConfirmTitle'),
      t('settings.privacy.actions.deleteConfirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => deleteMut.mutate(),
        },
      ],
    );

  if (settingsQ.isLoading || !draft) return <Loading />;
  if (settingsQ.isError) {
    return (
      <ErrorView
        message={messageFor(settingsQ.error)}
        onRetry={() => settingsQ.refetch()}
      />
    );
  }

  const groups: Array<['personalization' | 'aiData' | 'deviceContext' | 'behavior', string]> = [
    ['personalization', t('settings.privacy.section.personalization')],
    ['aiData', t('settings.privacy.section.aiData')],
    ['deviceContext', t('settings.privacy.section.deviceContext')],
    ['behavior', t('settings.privacy.section.behavior')],
  ];

  return (
    <Screen scroll>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Text
          style={{
            color: colors.text,
            fontSize: 22,
            fontWeight: '700',
            marginBottom: spacing.xs,
          }}
        >
          {t('settings.privacy.title')}
        </Text>
        <Text style={{ color: colors.textMuted, marginBottom: spacing.lg }}>
          {t('settings.privacy.subtitle')}
        </Text>

        {groups.map(([sectionKey, sectionLabel]) => (
          <View key={sectionKey} style={{ marginBottom: spacing.md }}>
            <Text
              style={{
                color: colors.textMuted,
                textTransform: 'uppercase',
                fontSize: 12,
                fontWeight: '700',
                marginBottom: spacing.xs,
              }}
            >
              {sectionLabel}
            </Text>
            <Card>
              {TOGGLES.filter((t2) => t2.section === sectionKey).map((row, idx, arr) => (
                <View
                  key={row.key}
                  style={{
                    paddingVertical: spacing.sm,
                    borderBottomWidth: idx === arr.length - 1 ? 0 : 1,
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
                      {t(`settings.privacy.${row.key}.label`)}
                    </Text>
                    <Switch
                      value={Boolean(draft[row.key])}
                      onValueChange={(v) => onToggle(row.key, row.consent, v)}
                      disabled={updateMut.isPending}
                    />
                  </View>
                  <Text style={{ color: colors.textMuted, marginTop: 4 }}>
                    {t(`settings.privacy.${row.key}.hint`)}
                  </Text>
                </View>
              ))}
            </Card>
          </View>
        ))}

        <Card style={{ marginBottom: spacing.md }}>
          <Text style={{ color: colors.textMuted }}>
            {t('settings.privacy.policyVersion')}: {PRIVACY_POLICY_VERSION}
            {'\n'}
            {t('settings.privacy.lastUpdated')}: {new Date(draft.updatedAt).toLocaleString()}
          </Text>
        </Card>

        <View style={{ gap: spacing.sm }}>
          <Button
            title={t('settings.privacy.permissions.title')}
            variant="secondary"
            onPress={() => nav.navigate('PermissionCenter')}
          />
          <Button
            title={t('settings.privacy.summary.title')}
            variant="secondary"
            onPress={() => nav.navigate('DataUsageSummary')}
          />
          <Button
            title={t('settings.privacy.actions.exportTitle')}
            variant="secondary"
            loading={exportMut.isPending}
            onPress={() => exportMut.mutate()}
          />
          <Button
            title={t('settings.privacy.actions.clearMemory')}
            variant="ghost"
            onPress={() => nav.navigate('ClearAIMemory')}
          />
          <Button
            title={t('settings.privacy.actions.deleteTitle')}
            variant="danger"
            loading={deleteMut.isPending}
            onPress={onDeleteAccount}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
