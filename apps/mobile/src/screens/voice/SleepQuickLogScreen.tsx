import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Card, Button, Input, Chip } from '../../components/ui';
import { voiceCompanionApi } from '../../services/api/voice-companion.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';

const QUALITIES = ['VERY_GOOD', 'GOOD', 'NORMAL', 'POOR', 'BAD'] as const;
type Quality = (typeof QUALITIES)[number];

export function SleepQuickLogScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const messageFor = useErrorMessage();
  const nav = useNavigation();

  const [sleepTime, setSleepTime] = useState(new Date(Date.now() - 8 * 3600_000).toISOString());
  const [wakeTime, setWakeTime] = useState(new Date().toISOString());
  const [quality, setQuality] = useState<Quality>('NORMAL');

  const mut = useMutation({
    mutationFn: () =>
      voiceCompanionApi.quickSleepLog({
        date: new Date().toISOString().slice(0, 10),
        sleepTime,
        wakeTime,
        quality,
      }),
    onSuccess: () => nav.goBack(),
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });

  return (
    <Screen scroll>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: spacing.md }}>
          {t('settings.sleepQuickLog.title')}
        </Text>
        <Card style={{ marginBottom: spacing.md, gap: spacing.md }}>
          <Input
            label={t('settings.sleepQuickLog.sleepTime')}
            value={sleepTime}
            onChangeText={setSleepTime}
            autoCapitalize="none"
          />
          <Input
            label={t('settings.sleepQuickLog.wakeTime')}
            value={wakeTime}
            onChangeText={setWakeTime}
            autoCapitalize="none"
          />
          <Text style={{ color: colors.textMuted }}>{t('settings.sleepQuickLog.quality')}</Text>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {QUALITIES.map((q) => (
              <Chip
                key={q}
                label={t(`settings.sleepQuickLog.qualityOption.${q}`)}
                selected={quality === q}
                onPress={() => setQuality(q)}
              />
            ))}
          </View>
        </Card>
        <Button
          title={t('settings.sleepQuickLog.save')}
          onPress={() => mut.mutate()}
          loading={mut.isPending}
          fullWidth
          size="lg"
        />
      </ScrollView>
    </Screen>
  );
}
