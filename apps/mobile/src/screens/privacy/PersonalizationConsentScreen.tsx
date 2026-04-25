import React, { useState } from 'react';
import { Alert, ScrollView, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme';
import { Screen, Card, Button } from '../../components/ui';
import { privacyApi, PRIVACY_POLICY_VERSION } from '../../services/api/privacy.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { QUERY_KEYS } from '../../constants';
import type { RootStackParamList } from '../../navigation/types';
import type {
  UpdatePrivacySettingsInput,
  UserConsentTypeDto,
} from '@planner/shared';

type ItemKey =
  | 'schedule' | 'habits' | 'meals' | 'health' | 'finance' | 'goals'
  | 'calendar' | 'healthFitness' | 'location' | 'voice'
  | 'proactive' | 'diagnostics';

type Group = 'dailyLife' | 'body' | 'money' | 'goals' | 'device' | 'behaviour';

type Item = {
  key: ItemKey;
  group: Group;
  /** Recommended (default for "Enable recommended"). */
  recommended: boolean;
  consent: UserConsentTypeDto | null;
  /** Field on PrivacySettings to set when this is on. */
  field: keyof UpdatePrivacySettingsInput;
};

const ITEMS: Item[] = [
  // dailyLife
  { key: 'schedule', group: 'dailyLife', recommended: true, consent: 'PERSONALIZATION', field: 'useScheduleForAI' },
  { key: 'habits',   group: 'dailyLife', recommended: true, consent: null,             field: 'useHabitsForAI' },
  // body
  { key: 'meals',  group: 'body', recommended: true, consent: null,             field: 'useMealsForAI' },
  { key: 'health', group: 'body', recommended: true, consent: 'AI_PROCESSING',   field: 'useHealthForAI' },
  // money
  { key: 'finance', group: 'money', recommended: true, consent: 'AI_PROCESSING', field: 'useFinanceForAI' },
  // goals
  { key: 'goals', group: 'goals', recommended: true, consent: null, field: 'useGoalsForAI' },
  // device
  { key: 'calendar',      group: 'device', recommended: false, consent: 'CALENDAR',       field: 'useCalendarContext' },
  { key: 'healthFitness', group: 'device', recommended: false, consent: 'HEALTH_FITNESS', field: 'useHealthFitnessContext' },
  { key: 'location',      group: 'device', recommended: false, consent: 'LOCATION',       field: 'useLocationContext' },
  { key: 'voice',         group: 'device', recommended: false, consent: 'MICROPHONE',     field: 'useVoiceInput' },
  // behaviour
  { key: 'proactive',   group: 'behaviour', recommended: true, consent: null,         field: 'proactiveRecommendations' },
  { key: 'diagnostics', group: 'behaviour', recommended: false, consent: 'DIAGNOSTICS', field: 'anonymizedDiagnostics' },
];

const GROUP_LABEL: Record<Group, string> = {
  dailyLife: 'settings.privacy.consent.groupDailyLifeTitle',
  body: 'settings.privacy.consent.groupBodyTitle',
  money: 'settings.privacy.consent.groupMoneyTitle',
  goals: 'settings.privacy.consent.groupGoalsTitle',
  device: 'settings.privacy.consent.groupDeviceTitle',
  behaviour: 'settings.privacy.consent.groupBehaviourTitle',
};

/**
 * Onboarding-style consent screen. Shown via the Settings entry today;
 * v1.3 will gate it behind a `personalizationConsentGivenAt` field on the
 * UserProfile so first-run users see it automatically before reaching
 * Today screen.
 *
 * Three CTAs:
 *   • Enable recommended — fast path: applies the recommended preset.
 *   • Customize          — interactive toggles + Save.
 *   • Skip for now       — no PUT, app still works with conservative
 *                           defaults (less personalised AI).
 */
export function PersonalizationConsentScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const messageFor = useErrorMessage();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const qc = useQueryClient();

  const [draft, setDraft] = useState<Record<ItemKey, boolean>>(() =>
    ITEMS.reduce(
      (acc, i) => ({ ...acc, [i.key]: i.recommended }),
      {} as Record<ItemKey, boolean>,
    ),
  );
  const [customizing, setCustomizing] = useState(false);

  const updateMut = useMutation({
    mutationFn: privacyApi.updateSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.privacySettings }),
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });

  const consentMut = useMutation({
    mutationFn: privacyApi.recordConsent,
    onError: () => undefined,
  });

  const apply = (preset: 'recommended' | 'custom' | 'skip') => {
    if (preset === 'skip') {
      nav.goBack();
      return;
    }
    const source = preset === 'recommended'
      ? Object.fromEntries(ITEMS.map((i) => [i.key, i.recommended])) as Record<ItemKey, boolean>
      : draft;
    const payload: UpdatePrivacySettingsInput = { personalizationEnabled: true };
    for (const item of ITEMS) {
      (payload as Record<string, boolean>)[item.field] = !!source[item.key];
    }
    updateMut.mutate(payload, {
      onSuccess: () => {
        // Best-effort consent log per item that is opted-in.
        for (const item of ITEMS) {
          if (item.consent && source[item.key]) {
            consentMut.mutate({
              consentType: item.consent,
              granted: true,
              version: PRIVACY_POLICY_VERSION,
              metadata: { source: 'onboarding' },
            });
          }
        }
        nav.goBack();
      },
    });
  };

  return (
    <Screen scroll>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700' }}>
          {t('settings.privacy.consent.title')}
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md }}>
          {t('settings.privacy.consent.intro')}
        </Text>
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>
            {t('settings.privacy.consent.promise')}
          </Text>
        </Card>

        {customizing ? (
          renderCustomize(ITEMS, draft, setDraft, t, colors, spacing)
        ) : (
          <Card style={{ marginBottom: spacing.md }}>
            <Text style={{ color: colors.textMuted }}>
              {ITEMS.filter((i) => i.recommended).length} /{ITEMS.length}{' '}
              recommended.
            </Text>
          </Card>
        )}

        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          {!customizing ? (
            <>
              <Button
                title={t('settings.privacy.consent.enableRecommended')}
                onPress={() => apply('recommended')}
                fullWidth
                size="lg"
              />
              <Button
                title={t('settings.privacy.consent.customize')}
                variant="secondary"
                onPress={() => setCustomizing(true)}
              />
            </>
          ) : (
            <Button
              title={t('settings.privacy.save')}
              onPress={() => apply('custom')}
              loading={updateMut.isPending}
              fullWidth
              size="lg"
            />
          )}
          <Button
            title={t('settings.privacy.consent.skip')}
            variant="ghost"
            onPress={() => apply('skip')}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function renderCustomize(
  items: Item[],
  draft: Record<ItemKey, boolean>,
  setDraft: (next: Record<ItemKey, boolean>) => void,
  t: (k: string) => string,
  colors: { text: string; textMuted: string; border: string },
  spacing: { xs: number; sm: number; md: number },
) {
  const groups: Group[] = ['dailyLife', 'body', 'money', 'goals', 'device', 'behaviour'];
  return (
    <View>
      {groups.map((g) => (
        <View key={g} style={{ marginBottom: spacing.md }}>
          <Text
            style={{
              color: colors.textMuted,
              textTransform: 'uppercase',
              fontSize: 12,
              fontWeight: '700',
              marginBottom: spacing.xs,
            }}
          >
            {t(GROUP_LABEL[g])}
          </Text>
          <Card>
            {items
              .filter((i) => i.group === g)
              .map((item, idx, arr) => (
                <View
                  key={item.key}
                  style={{
                    paddingVertical: spacing.sm,
                    borderBottomWidth: idx === arr.length - 1 ? 0 : 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{ color: colors.text, fontWeight: '600', flex: 1, paddingRight: 8 }}
                    >
                      {t(`settings.privacy.consent.items.${item.key}.title`)}
                    </Text>
                    <Switch
                      value={draft[item.key]}
                      onValueChange={(v) => setDraft({ ...draft, [item.key]: v })}
                    />
                  </View>
                  <Text style={{ color: colors.textMuted, marginTop: 4 }}>
                    {t(`settings.privacy.consent.items.${item.key}.purpose`)}
                  </Text>
                </View>
              ))}
          </Card>
        </View>
      ))}
    </View>
  );
}
