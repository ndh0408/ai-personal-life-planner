import React from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Card, Button } from '../../components/ui';
import { privacyApi } from '../../services/api/privacy.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';

/**
 * Standalone "Clear AI memory" screen — full screen instead of a modal so
 * the explainer copy has room. The destructive action is gated by an
 * Alert.alert confirm because the memory wipe is one-way.
 */
export function ClearAIMemoryScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const messageFor = useErrorMessage();
  const nav = useNavigation();

  const mut = useMutation({
    mutationFn: privacyApi.clearAiMemory,
    onSuccess: (r) => {
      Alert.alert(
        t('settings.privacy.clearMemory.title'),
        t('settings.privacy.clearMemory.doneToast', { count: r.cleared }),
      );
      nav.goBack();
    },
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });

  const onConfirm = () => {
    Alert.alert(
      t('settings.privacy.clearMemory.confirmTitle'),
      t('settings.privacy.clearMemory.confirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.privacy.clearMemory.cta'),
          style: 'destructive',
          onPress: () => mut.mutate(),
        },
      ],
    );
  };

  return (
    <Screen scroll>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: spacing.xs }}>
          {t('settings.privacy.clearMemory.title')}
        </Text>
        <Text style={{ color: colors.textMuted, marginBottom: spacing.md }}>
          {t('settings.privacy.clearMemory.subtitle')}
        </Text>

        <Text
          style={{
            color: colors.textMuted,
            textTransform: 'uppercase',
            fontSize: 12,
            fontWeight: '700',
            marginBottom: spacing.xs,
          }}
        >
          {t('settings.privacy.clearMemory.explainerTitle')}
        </Text>
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={{ color: colors.text, lineHeight: 20 }}>
            {t('settings.privacy.clearMemory.explainer')}
          </Text>
        </Card>

        <Button
          title={
            mut.isPending
              ? `${t('settings.privacy.clearMemory.cta')}…`
              : t('settings.privacy.clearMemory.cta')
          }
          variant="danger"
          onPress={onConfirm}
          loading={mut.isPending}
          fullWidth
          size="lg"
        />
      </ScrollView>
    </Screen>
  );
}
