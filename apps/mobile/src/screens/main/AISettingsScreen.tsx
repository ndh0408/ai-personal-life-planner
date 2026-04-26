import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppHeader,
  AppScreen,
  Button,
  Card,
  ConfirmModal,
  ErrorState,
  LoadingState,
  Text,
  TextField,
  useToast,
} from '../../components/ui';
import { spacing, colors } from '../../theme';
import { aiKeyService } from '../../services/api/aiKey.service';
import { useAiKeyStatus } from '../../hooks/useAiKeyStatus';
import { useAuthStore } from '../../store/auth.store';
import { readableError } from '../../utils/error';
import { QK } from '../../services/api/queryClient';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AISettings'>;

export function AISettingsScreen({ navigation }: Props) {
  const { t, i18n: { language } } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const markAiKeyConfigured = useAuthStore((s) => s.markAiKeyConfigured);
  const { data: status, isLoading, isError, refetch } = useAiKeyStatus();
  const [replaceMode, setReplaceMode] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const test = useMutation({
    mutationFn: () => aiKeyService.test(),
    onSuccess: (r) => {
      toast.show(
        r.status === 'SUCCESS' ? t('aiSettings.testStatusSuccess') : t('aiSettings.testStatusFailed'),
        r.status === 'SUCCESS' ? 'success' : 'warning',
      );
      void refetch();
    },
    onError: (e) => toast.show(readableError(e, t, 'onboarding.aiSetup'), 'danger'),
  });

  const replace = useMutation({
    mutationFn: (key: string) => aiKeyService.setupOpenAi(key),
    onSuccess: (s) => {
      qc.setQueryData(QK.aiKeyStatus, s);
      setNewKey('');
      setReplaceMode(false);
      setReplaceError(null);
      toast.show(t('onboarding.aiSetup.successTitle'), 'success');
    },
    onError: (e) => setReplaceError(readableError(e, t, 'onboarding.aiSetup')),
  });

  const remove = useMutation({
    mutationFn: () => aiKeyService.remove(),
    onSuccess: () => {
      markAiKeyConfigured(false);
      void refetch();
      setConfirmDelete(false);
    },
  });

  const formattedTime = status?.lastTestedAt
    ? new Date(status.lastTestedAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')
    : t('aiSettings.testNever');

  return (
    <AppScreen>
      <AppHeader
        kicker={t('aiSettings.title')}
        title={status?.enabled ? t('aiSettings.statusEnabled') : t('aiSettings.statusDisabled')}
        onBack={() => navigation.goBack()}
      />

      {isLoading || !status ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <View style={{ gap: spacing.lg }}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: !status.enabled
                    ? colors.text.muted
                    : status.lastTestStatus === 'SUCCESS'
                    ? colors.status.success
                    : status.lastTestStatus === 'FAILED'
                    ? colors.status.danger
                    : colors.status.warning,
                }}
              />
              <Text variant="bodyEm">{status.maskedApiKey ?? '—'}</Text>
            </View>
            <Text variant="caption">{`${t('aiSettings.lastTest')}: ${formattedTime}`}</Text>
            <Text variant="caption">
              {status.lastTestStatus === 'SUCCESS'
                ? t('aiSettings.testStatusSuccess')
                : status.lastTestStatus === 'FAILED'
                ? t('aiSettings.testStatusFailed')
                : t('aiSettings.testNever')}
            </Text>
          </Card>

          {replaceMode ? (
            <View style={{ gap: spacing.md }}>
              <TextField
                label={t('onboarding.aiSetup.keyLabel')}
                placeholder={t('onboarding.aiSetup.keyPlaceholder')}
                value={newKey}
                onChangeText={setNewKey}
                secret
                error={replaceError}
              />
              <Button
                label={t('onboarding.aiSetup.saveCta')}
                onPress={() => replace.mutate(newKey.trim())}
                loading={replace.isPending}
                disabled={replace.isPending || newKey.trim().length < 20}
              />
              <Button
                label={t('common.cancel')}
                variant="ghost"
                onPress={() => {
                  setNewKey('');
                  setReplaceMode(false);
                  setReplaceError(null);
                }}
              />
            </View>
          ) : (
            <View style={{ gap: spacing.md }}>
              {status.enabled ? (
                <>
                  <Button
                    label={t('aiSettings.testCta')}
                    variant="secondary"
                    onPress={() => test.mutate()}
                    loading={test.isPending}
                    disabled={test.isPending}
                  />
                  <Button
                    label={t('aiSettings.replaceCta')}
                    variant="secondary"
                    onPress={() => setReplaceMode(true)}
                  />
                  <Button
                    label={t('aiSettings.deleteCta')}
                    variant="danger"
                    onPress={() => setConfirmDelete(true)}
                  />
                </>
              ) : (
                <Button
                  label={t('onboarding.aiSetup.saveCta')}
                  onPress={() => setReplaceMode(true)}
                />
              )}
            </View>
          )}
        </View>
      )}

      <ConfirmModal
        visible={confirmDelete}
        title={t('aiSettings.deleteConfirmTitle')}
        body={t('aiSettings.deleteConfirmBody')}
        confirmLabel={t('aiSettings.deleteConfirmYes')}
        cancelLabel={t('aiSettings.deleteConfirmNo')}
        destructive
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
    </AppScreen>
  );
}
