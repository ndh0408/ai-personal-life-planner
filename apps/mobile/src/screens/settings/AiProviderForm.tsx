import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Card, Button, Input, Loading, ErrorView, Chip } from '../../components/ui';
import { userAiProvidersApi } from '../../services/api/user-ai-providers.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { QUERY_KEYS } from '../../constants';
import type {
  CreateUserAiProviderInput,
  UpdateUserAiProviderInput,
  UserAiProviderTypeDto,
} from '@planner/shared';

const PROVIDER_OPTIONS: UserAiProviderTypeDto[] = [
  'OPENAI',
  'NVIDIA',
  'GEMINI',
  'ANTHROPIC',
  'OPENROUTER',
  'CUSTOM_OPENAI_COMPATIBLE',
];

type FormState = {
  provider: UserAiProviderTypeDto;
  name: string;
  baseUrl: string;
  apiKey: string;
  defaultChatModel: string;
  defaultPlannerModel: string;
  defaultFinanceModel: string;
  defaultMealModel: string;
  defaultHealthModel: string;
  defaultReportModel: string;
  isDefault: boolean;
};

const EMPTY: FormState = {
  provider: 'OPENAI',
  name: '',
  baseUrl: '',
  apiKey: '',
  defaultChatModel: '',
  defaultPlannerModel: '',
  defaultFinanceModel: '',
  defaultMealModel: '',
  defaultHealthModel: '',
  defaultReportModel: '',
  isDefault: false,
};

export function AiProviderForm({ providerId }: { providerId?: string }) {
  const isEdit = !!providerId;
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const messageFor = useErrorMessage();
  const nav = useNavigation();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);
  const apiKeyClearedRef = useRef(false);

  const existingQ = useQuery({
    queryKey: providerId ? QUERY_KEYS.aiProvider(providerId) : ['noop-provider'],
    queryFn: async () => {
      const list = await userAiProvidersApi.list();
      return list.find((p) => p.id === providerId) ?? null;
    },
    enabled: isEdit,
  });

  useEffect(() => {
    if (!isEdit || !existingQ.data) return;
    setForm({
      provider: existingQ.data.provider,
      name: existingQ.data.name,
      baseUrl: existingQ.data.baseUrl ?? '',
      apiKey: '',
      defaultChatModel: existingQ.data.defaultChatModel ?? '',
      defaultPlannerModel: existingQ.data.defaultPlannerModel ?? '',
      defaultFinanceModel: existingQ.data.defaultFinanceModel ?? '',
      defaultMealModel: existingQ.data.defaultMealModel ?? '',
      defaultHealthModel: existingQ.data.defaultHealthModel ?? '',
      defaultReportModel: existingQ.data.defaultReportModel ?? '',
      isDefault: existingQ.data.isDefault,
    });
  }, [existingQ.data, isEdit]);

  const requiresBaseUrl = form.provider === 'CUSTOM_OPENAI_COMPATIBLE';

  const validate = (): string | null => {
    if (!form.name.trim()) return 'name';
    if (!isEdit && !form.apiKey.trim()) return 'apiKey';
    if (requiresBaseUrl && !form.baseUrl.trim()) return 'baseUrl';
    return null;
  };

  const buildCreatePayload = (): CreateUserAiProviderInput => ({
    provider: form.provider,
    name: form.name.trim(),
    baseUrl: form.baseUrl.trim() || undefined,
    apiKey: form.apiKey.trim(),
    defaultChatModel: form.defaultChatModel.trim() || undefined,
    defaultPlannerModel: form.defaultPlannerModel.trim() || undefined,
    defaultFinanceModel: form.defaultFinanceModel.trim() || undefined,
    defaultMealModel: form.defaultMealModel.trim() || undefined,
    defaultHealthModel: form.defaultHealthModel.trim() || undefined,
    defaultReportModel: form.defaultReportModel.trim() || undefined,
    isDefault: form.isDefault,
  });

  const buildUpdatePayload = (): UpdateUserAiProviderInput => {
    const payload: UpdateUserAiProviderInput = {
      name: form.name.trim(),
      baseUrl: form.baseUrl.trim() || null,
      defaultChatModel: form.defaultChatModel.trim() || null,
      defaultPlannerModel: form.defaultPlannerModel.trim() || null,
      defaultFinanceModel: form.defaultFinanceModel.trim() || null,
      defaultMealModel: form.defaultMealModel.trim() || null,
      defaultHealthModel: form.defaultHealthModel.trim() || null,
      defaultReportModel: form.defaultReportModel.trim() || null,
      isDefault: form.isDefault,
    };
    if (form.apiKey.trim().length > 0) payload.apiKey = form.apiKey.trim();
    return payload;
  };

  const createMut = useMutation({
    mutationFn: () => userAiProvidersApi.create(buildCreatePayload()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.aiProviders });
      apiKeyClearedRef.current = true;
      setForm((s) => ({ ...s, apiKey: '' }));
      nav.goBack();
    },
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });

  const updateMut = useMutation({
    mutationFn: () => userAiProvidersApi.update(providerId as string, buildUpdatePayload()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.aiProviders });
      apiKeyClearedRef.current = true;
      setForm((s) => ({ ...s, apiKey: '' }));
      nav.goBack();
    },
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });

  const onSubmit = () => {
    const missing = validate();
    if (missing) {
      Alert.alert(
        t('errors.INVALID_PROVIDER_CONFIG'),
        t(`settings.aiProviders.${missing === 'apiKey' ? 'apiKey' : missing === 'baseUrl' ? 'baseUrl' : 'name'}`),
      );
      return;
    }
    if (isEdit) updateMut.mutate();
    else createMut.mutate();
  };

  const submitting = createMut.isPending || updateMut.isPending;

  // Don't keep the apiKey in memory longer than necessary — when the screen
  // unmounts we wipe whatever was typed.
  useEffect(() => {
    return () => {
      setForm((s) => ({ ...s, apiKey: '' }));
    };
  }, []);

  if (isEdit && existingQ.isLoading) return <Loading />;
  if (isEdit && existingQ.isError) {
    return <ErrorView message={messageFor(existingQ.error)} onRetry={() => existingQ.refetch()} />;
  }

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
          {isEdit ? t('settings.aiProviders.edit') : t('settings.aiProviders.addProvider')}
        </Text>

        <Card style={{ marginBottom: spacing.md }}>
          <Text style={{ color: colors.textMuted }}>
            {t('settings.aiProviders.keyEncryptedNotice')}
          </Text>
        </Card>

        <Text style={{ color: colors.text, fontWeight: '600', marginBottom: spacing.sm }}>
          {t('settings.aiProviders.providerType')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md }}>
          {PROVIDER_OPTIONS.map((p) => (
            <Chip
              key={p}
              label={t(`settings.aiProviders.providers.${p}`)}
              selected={form.provider === p}
              onPress={
                isEdit ? undefined : () => setForm((s) => ({ ...s, provider: p }))
              }
            />
          ))}
        </View>

        <Text style={{ color: colors.textMuted, marginBottom: spacing.md }}>
          {t(`settings.aiProviders.hint.${form.provider}`)}
        </Text>

        <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
          <Input
            label={t('settings.aiProviders.name')}
            value={form.name}
            placeholder={t('settings.aiProviders.namePlaceholder')}
            onChangeText={(v) => setForm((s) => ({ ...s, name: v }))}
            autoCapitalize="none"
          />
          <Input
            label={
              requiresBaseUrl
                ? t('settings.aiProviders.baseUrlRequired')
                : t('settings.aiProviders.baseUrlOptional')
            }
            value={form.baseUrl}
            onChangeText={(v) => setForm((s) => ({ ...s, baseUrl: v }))}
            autoCapitalize="none"
            keyboardType="url"
          />
          <Input
            label={t('settings.aiProviders.apiKey')}
            value={form.apiKey}
            onChangeText={(v) => setForm((s) => ({ ...s, apiKey: v }))}
            placeholder={isEdit ? t('settings.aiProviders.apiKeyExisting') : ''}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            // Disable iOS / Android paste-from-keychain UI from caching the key.
            textContentType="password"
          />
        </View>

        <Text style={{ color: colors.text, fontWeight: '600', marginBottom: spacing.sm }}>
          {t('settings.aiProviders.models')}
        </Text>
        <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
          {(
            [
              ['defaultChatModel', 'modelChat'],
              ['defaultPlannerModel', 'modelPlanner'],
              ['defaultFinanceModel', 'modelFinance'],
              ['defaultMealModel', 'modelMeal'],
              ['defaultHealthModel', 'modelHealth'],
              ['defaultReportModel', 'modelReport'],
            ] as const
          ).map(([key, labelKey]) => (
            <Input
              key={key}
              label={t(`settings.aiProviders.${labelKey}`)}
              value={form[key]}
              onChangeText={(v) => setForm((s) => ({ ...s, [key]: v } as FormState))}
              autoCapitalize="none"
              autoCorrect={false}
              helper={t('settings.aiProviders.modelHint')}
            />
          ))}
        </View>

        <Card style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.text, flex: 1 }}>{t('settings.aiProviders.isDefault')}</Text>
            <Switch
              value={form.isDefault}
              onValueChange={(v) => setForm((s) => ({ ...s, isDefault: v }))}
            />
          </View>
        </Card>

        <Button
          title={submitting ? t('settings.aiProviders.saving') : t('settings.aiProviders.save')}
          onPress={onSubmit}
          loading={submitting}
          fullWidth
          size="lg"
        />
      </ScrollView>
    </Screen>
  );
}
