import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AppHeader,
  AppScreen,
  BottomSheet,
  Button,
  Card,
  Text,
  TextField,
  useToast,
} from '../../components/ui';
import { spacing } from '../../theme';
import { aiKeyService } from '../../services/api/aiKey.service';
import { useAuthStore } from '../../store/auth.store';
import { readableError } from '../../utils/error';
import { QK } from '../../services/api/queryClient';

const Schema = z.object({
  apiKey: z.string().min(20).max(200).regex(/^sk-/, 'sk-'),
});
type FormValues = z.infer<typeof Schema>;

export function AISetupScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const markAiKeyConfigured = useAuthStore((s) => s.markAiKeyConfigured);
  const finishOnboarding = useAuthStore((s) => s.finishOnboarding);
  const [helpOpen, setHelpOpen] = useState(false);

  const { control, handleSubmit, formState, reset } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { apiKey: '' },
    mode: 'onChange',
  });

  const setup = useMutation({
    mutationFn: (apiKey: string) => aiKeyService.setupOpenAi(apiKey),
    onSuccess: (status) => {
      reset({ apiKey: '' }); // drop raw key from React state
      qc.setQueryData(QK.aiKeyStatus, status);
      if (status.lastTestStatus === 'SUCCESS') {
        toast.show(t('onboarding.aiSetup.successTitle'), 'success');
        markAiKeyConfigured(true);
      } else {
        toast.show(t('onboarding.aiSetup.errors.AI_KEY_TEST_FAILED'), 'warning');
        markAiKeyConfigured(true);
      }
    },
    onError: (e) => {
      toast.show(readableError(e, t, 'onboarding.aiSetup'), 'danger');
    },
  });

  const onSubmit = handleSubmit((values) => setup.mutate(values.apiKey.trim()));

  return (
    <AppScreen>
      <AppHeader
        kicker={t('onboarding.aiSetup.kicker')}
        title={t('onboarding.aiSetup.title')}
      />
      <Text style={{ marginBottom: spacing.xl }}>{t('onboarding.aiSetup.subtitle')}</Text>

      <View style={{ gap: spacing.lg }}>
        <Controller
          control={control}
          name="apiKey"
          render={({ field, fieldState }) => (
            <TextField
              label={t('onboarding.aiSetup.keyLabel')}
              placeholder={t('onboarding.aiSetup.keyPlaceholder')}
              value={field.value}
              onChangeText={field.onChange}
              secret
              error={
                fieldState.error
                  ? t('onboarding.aiSetup.errors.AI_KEY_INVALID_FORMAT')
                  : null
              }
            />
          )}
        />
        <Button
          label={setup.isPending ? t('onboarding.aiSetup.testing') : t('onboarding.aiSetup.saveCta')}
          onPress={onSubmit}
          loading={setup.isPending}
          disabled={!formState.isValid || setup.isPending}
        />
        <Button
          label={t('onboarding.aiSetup.skipCta')}
          variant="ghost"
          onPress={finishOnboarding}
        />
        <Text
          variant="link"
          style={{ textAlign: 'center', marginTop: spacing.sm }}
          onPress={() => setHelpOpen(true)}
        >
          {t('onboarding.aiSetup.noKeyHint')}
        </Text>
      </View>

      <BottomSheet visible={helpOpen} onClose={() => setHelpOpen(false)} heightRatio={0.5}>
        <Card emphasis="elevated">
          <Text variant="title">{t('onboarding.aiSetup.noKeyModalTitle')}</Text>
          <Text>{t('onboarding.aiSetup.noKeyModalBody')}</Text>
          <View style={{ marginTop: spacing.md }}>
            <Button label={t('common.ok')} onPress={() => setHelpOpen(false)} />
          </View>
        </Card>
      </BottomSheet>
    </AppScreen>
  );
}
