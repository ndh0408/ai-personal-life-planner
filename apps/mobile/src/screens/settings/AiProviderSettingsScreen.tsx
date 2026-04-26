import React, { useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme';
import { Screen, Card, Button, Loading, ErrorView, Badge } from '../../components/ui';
import { userAiProvidersApi } from '../../services/api/user-ai-providers.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { QUERY_KEYS } from '../../constants';
import { formatDateByLocale } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';
import type {
  UserAiPreferenceDto,
  UserAiProviderDto,
  UserAiProviderTypeDto,
} from '@planner/shared';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * AI provider settings screen.
 *
 * Round 20.5 redesign: the consumer-grade fast path (paste an OpenAI
 * key, get AI features) lives in `AISetupScreen` and is the primary CTA
 * here. The full multi-provider form is collapsed under "Advanced" so
 * non-technical users never see provider/baseUrl/model fields they
 * don't understand.
 */
export function AiProviderSettingsScreen() {
  const { colors, spacing, typography } = useTheme();
  const { t } = useTranslation();
  const messageFor = useErrorMessage();
  const nav = useNavigation<Nav>();
  const qc = useQueryClient();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const providersQ = useQuery({
    queryKey: QUERY_KEYS.aiProviders,
    queryFn: userAiProvidersApi.list,
  });
  const prefQ = useQuery({
    queryKey: QUERY_KEYS.aiPreference,
    queryFn: userAiProvidersApi.getPreference,
  });

  const updatePref = useMutation({
    mutationFn: userAiProvidersApi.updatePreference,
    onSuccess: (next) =>
      qc.setQueryData<UserAiPreferenceDto>(QUERY_KEYS.aiPreference, next),
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });

  const testProvider = useMutation({
    mutationFn: (id: string) => userAiProvidersApi.test(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.aiProviders });
      if (res.ok) {
        Alert.alert(t('settings.aiProviders.testSuccess'));
      } else {
        const code = res.errorCode ?? 'AI_PROVIDER_TEST_FAILED';
        Alert.alert(
          t(`errors.${code}`, { defaultValue: t('errors.AI_PROVIDER_TEST_FAILED') }),
          res.errorMessage ?? '',
        );
      }
    },
    onError: (e) => Alert.alert(t('settings.aiProviders.testFailedTitle'), messageFor(e)),
  });

  const setDefault = useMutation({
    mutationFn: (id: string) => userAiProvidersApi.update(id, { isDefault: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.aiProviders }),
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => userAiProvidersApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.aiProviders }),
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });

  if (providersQ.isLoading || prefQ.isLoading) return <Loading />;
  if (providersQ.isError) {
    return (
      <ErrorView
        message={messageFor(providersQ.error)}
        onRetry={() => providersQ.refetch()}
      />
    );
  }

  const providers: UserAiProviderDto[] = providersQ.data ?? [];
  const pref = prefQ.data ?? {
    useOwnApiKey: false,
    fallbackToGlobalProvider: true,
    defaultProviderId: null,
  };
  const openAi = providers.find((p) => p.provider === 'OPENAI' && p.isDefault) ?? providers[0];
  const hasAny = providers.length > 0;

  const onDelete = (p: UserAiProviderDto) => {
    Alert.alert(
      t('settings.aiSetup.removeConfirmTitle'),
      t('settings.aiSetup.removeConfirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => remove.mutate(p.id),
        },
      ],
    );
  };

  return (
    <Screen scroll>
      <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.xs }]}>
        {t('settings.aiProviders.title')}
      </Text>
      <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.lg }]}>
        {t('settings.aiProviders.subtitle')}
      </Text>

      {/* Hero card — Connect OpenAI fast path. */}
      {!hasAny ? (
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.h2, { color: colors.text, marginBottom: spacing.xs }]}>
            {t('settings.aiSetup.noKeyTitle')}
          </Text>
          <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.md }]}>
            {t('settings.aiSetup.noKeyBody')}
          </Text>
          <Button
            title={t('settings.aiSetup.addKey')}
            onPress={() => nav.navigate('AISetup')}
            fullWidth
          />
        </Card>
      ) : openAi ? (
        <Card style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyStrong, { color: colors.text }]}>
                {t('settings.aiSetup.keyPresent')}
              </Text>
              <Text style={[{ color: colors.text, fontFamily: 'monospace', marginTop: spacing.xs }]}>
                {openAi.maskedApiKey}
              </Text>
              {openAi.lastTestedAt ? (
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
                  {t('settings.aiSetup.lastTestedAgo', {
                    ago: formatDateByLocale(openAi.lastTestedAt),
                  })}
                </Text>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <Badge tone={openAi.isActive ? 'success' : 'danger'}>
                {openAi.isActive
                  ? t('settings.aiProviders.statusActive')
                  : t('settings.aiProviders.statusInactive')}
              </Badge>
              {openAi.lastTestStatus === 'SUCCESS' ? (
                <Badge tone="success">{t('settings.aiProviders.statusSuccess')}</Badge>
              ) : openAi.lastTestStatus === 'FAILED' ? (
                <Badge tone="danger">{t('settings.aiProviders.statusFailed')}</Badge>
              ) : null}
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' }}>
            <Button
              title={
                testProvider.isPending && testProvider.variables === openAi.id
                  ? t('settings.aiProviders.testing')
                  : t('settings.aiProviders.test')
              }
              variant="secondary"
              onPress={() => testProvider.mutate(openAi.id)}
              disabled={testProvider.isPending}
            />
            <Button
              title={t('settings.aiSetup.replaceKey')}
              variant="secondary"
              onPress={() => nav.navigate('AISetup')}
            />
            <Button
              title={t('settings.aiSetup.removeKey')}
              variant="danger"
              onPress={() => onDelete(openAi)}
            />
          </View>
        </Card>
      ) : null}

      {/* Preference toggles. */}
      {hasAny ? (
        <Card style={{ marginBottom: spacing.md }}>
          <ToggleRow
            label={t('settings.aiProviders.useOwnKey')}
            hint={t('settings.aiProviders.useOwnKeyHint')}
            value={pref.useOwnApiKey}
            onChange={(v) => updatePref.mutate({ useOwnApiKey: v })}
          />
          <View style={{ height: spacing.md }} />
          <ToggleRow
            label={t('settings.aiProviders.fallbackToGlobal')}
            hint={t('settings.aiProviders.fallbackHint')}
            value={pref.fallbackToGlobalProvider}
            onChange={(v) => updatePref.mutate({ fallbackToGlobalProvider: v })}
          />
        </Card>
      ) : null}

      {/* Advanced section — full multi-provider form lives here. */}
      <Card style={{ marginBottom: spacing.md }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={[typography.bodyStrong, { color: colors.text }]}>
              {t('settings.aiProviders.advanced')}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
              {t('settings.aiProviders.advancedHint')}
            </Text>
          </View>
          <Switch value={showAdvanced} onValueChange={setShowAdvanced} />
        </View>

        {showAdvanced ? (
          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            {providers
              .filter((p) => !openAi || p.id !== openAi.id)
              .map((p) => (
                <View
                  key={p.id}
                  style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[typography.bodyStrong, { color: colors.text }]}>{p.name}</Text>
                    {p.isDefault ? (
                      <Badge tone="primary">{t('settings.aiProviders.setDefault')}</Badge>
                    ) : null}
                  </View>
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                    {t(`settings.aiProviders.providers.${p.provider as UserAiProviderTypeDto}`)}
                  </Text>
                  <Text
                    style={[{ color: colors.text, fontFamily: 'monospace', marginTop: spacing.xs }]}
                  >
                    {p.maskedApiKey}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' }}>
                    <Button
                      title={t('settings.aiProviders.test')}
                      variant="secondary"
                      onPress={() => testProvider.mutate(p.id)}
                      disabled={testProvider.isPending}
                    />
                    <Button
                      title={t('settings.aiProviders.edit')}
                      variant="secondary"
                      onPress={() => nav.navigate('EditAiProvider', { providerId: p.id })}
                    />
                    {!p.isDefault ? (
                      <Button
                        title={t('settings.aiProviders.setDefault')}
                        variant="ghost"
                        onPress={() => setDefault.mutate(p.id)}
                      />
                    ) : null}
                    <Button
                      title={t('common.delete')}
                      variant="danger"
                      onPress={() => onDelete(p)}
                    />
                  </View>
                </View>
              ))}
            <Button
              title={t('settings.aiProviders.addProvider')}
              onPress={() => nav.navigate('AddAiProvider')}
              style={{ marginTop: spacing.md }}
            />
          </View>
        ) : null}
      </Card>
    </Screen>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { colors, spacing } = useTheme();
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: colors.text, fontWeight: '600', flex: 1 }}>{label}</Text>
        <Switch value={value} onValueChange={onChange} />
      </View>
      {hint ? (
        <Text style={{ color: colors.textMuted, marginTop: spacing.xs }}>{hint}</Text>
      ) : null}
    </View>
  );
}
