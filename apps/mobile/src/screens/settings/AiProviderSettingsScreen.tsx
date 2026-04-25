import React from 'react';
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
import type { RootStackParamList } from '../../navigation/types';
import type {
  UserAiPreferenceDto,
  UserAiProviderDto,
  UserAiProviderTypeDto,
} from '@planner/shared';

export function AiProviderSettingsScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const messageFor = useErrorMessage();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const qc = useQueryClient();

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
        Alert.alert(
          t('settings.aiProviders.testFailedTitle'),
          res.errorMessage ?? t('errors.AI_PROVIDER_TEST_FAILED'),
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

  const onToggleUseOwn = (val: boolean) => {
    if (val && providers.length === 0) {
      Alert.alert(
        t('settings.aiProviders.useOwnKey'),
        t('errors.AI_PROVIDER_NOT_CONFIGURED'),
      );
      return;
    }
    updatePref.mutate({ useOwnApiKey: val });
  };

  const onDelete = (p: UserAiProviderDto) => {
    Alert.alert(t('settings.aiProviders.deleteConfirm'), t('settings.aiProviders.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => remove.mutate(p.id),
      },
    ]);
  };

  return (
    <Screen scroll>
      <Text
        style={{
          color: colors.text,
          fontSize: 22,
          fontWeight: '700',
          marginBottom: spacing.xs,
        }}
      >
        {t('settings.aiProviders.title')}
      </Text>
      <Text style={{ color: colors.textMuted, marginBottom: spacing.lg }}>
        {t('settings.aiProviders.subtitle')}
      </Text>

      {/* Toggles ----------------------------------------------------------- */}
      <Card style={{ marginBottom: spacing.md }}>
        <ToggleRow
          label={t('settings.aiProviders.useOwnKey')}
          hint={t('settings.aiProviders.useOwnKeyHint')}
          value={pref.useOwnApiKey}
          onChange={onToggleUseOwn}
        />
        <View style={{ height: spacing.md }} />
        <ToggleRow
          label={t('settings.aiProviders.fallbackToGlobal')}
          hint={t('settings.aiProviders.fallbackHint')}
          value={pref.fallbackToGlobalProvider}
          onChange={(v) => updatePref.mutate({ fallbackToGlobalProvider: v })}
        />
      </Card>

      {/* Provider list ----------------------------------------------------- */}
      {providers.length === 0 ? (
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={{ color: colors.text, fontWeight: '600', marginBottom: spacing.xs }}>
            {t('settings.aiProviders.noProviders')}
          </Text>
          <Text style={{ color: colors.textMuted }}>
            {t('settings.aiProviders.noProvidersHint')}
          </Text>
        </Card>
      ) : (
        providers.map((p) => (
          <Card key={p.id} style={{ marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{p.name}</Text>
              {p.isDefault ? <Badge tone="primary">{t('settings.aiProviders.setDefault')}</Badge> : null}
            </View>
            <Text style={{ color: colors.textMuted, marginTop: 2 }}>
              {t(`settings.aiProviders.providers.${p.provider as UserAiProviderTypeDto}`)}
            </Text>
            <Text
              style={{
                color: colors.text,
                marginTop: spacing.xs,
                fontFamily: 'monospace',
              }}
            >
              {p.maskedApiKey}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: spacing.sm, flexWrap: 'wrap' }}>
              <Badge tone={p.isActive ? 'success' : 'danger'}>
                {p.isActive ? t('settings.aiProviders.statusActive') : t('settings.aiProviders.statusInactive')}
              </Badge>
              {p.lastTestStatus === 'SUCCESS' ? (
                <Badge tone="success">{t('settings.aiProviders.statusSuccess')}</Badge>
              ) : p.lastTestStatus === 'FAILED' ? (
                <Badge tone="danger">{t('settings.aiProviders.statusFailed')}</Badge>
              ) : (
                <Badge tone="info">{t('settings.aiProviders.neverTested')}</Badge>
              )}
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.md, flexWrap: 'wrap' }}>
              <Button
                title={testProvider.isPending && testProvider.variables === p.id
                  ? t('settings.aiProviders.testing')
                  : t('settings.aiProviders.test')}
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
                title={t('settings.aiProviders.delete')}
                variant="danger"
                onPress={() => onDelete(p)}
              />
            </View>
          </Card>
        ))
      )}

      <Button
        title={t('settings.aiProviders.addProvider')}
        onPress={() => nav.navigate('AddAiProvider')}
      />
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
