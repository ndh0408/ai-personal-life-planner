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
  { key: 'useFinanceForAI', consent: null, section: 'aiData' },
  { key: 'useHealthForAI', consent: null, section: 'aiData' },
  { key: 'useMealForAI', consent: null, section: 'aiData' },
  { key: 'useCalendarContext', consent: 'CALENDAR', section: 'deviceContext' },
  { key: 'useLocationContext', consent: 'LOCATION', section: 'deviceContext' },
  {
    key: 'useHealthFitnessContext',
    consent: 'HEALTH_FITNESS',
    section: 'deviceContext',
  },
  { key: 'voiceInputEnabled', consent: 'MICROPHONE', section: 'deviceContext' },
  { key: 'proactiveRecommendations', consent: null, section: 'behavior' },
  { key: 'anonymizedDiagnostics', consent: 'DIAGNOSTICS', section: 'behavior' },
];

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

  const onToggle = (key: ToggleKey, consent: ConsentType | null, value: boolean) => {
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
        </View>
      </ScrollView>
    </Screen>
  );
}
