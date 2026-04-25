import React from 'react';
import { ScrollView, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme';
import { Screen, Card, Button } from '../../components/ui';
import { voiceCompanionApi } from '../../services/api/voice-companion.api';
import { QUERY_KEYS } from '../../constants';
import type { RootStackParamList } from '../../navigation/types';

export function VoiceCompanionScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const pendingQ = useQuery({
    queryKey: QUERY_KEYS.pendingActions,
    queryFn: voiceCompanionApi.pendingActions,
  });
  const pendingCount = pendingQ.data?.length ?? 0;

  return (
    <Screen scroll>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>
          {t('settings.voice.title')}
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md }}>
          {t('settings.voice.subtitle')}
        </Text>
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>
            {t('settings.voice.promise')}
          </Text>
        </Card>

        <Button
          title={t('settings.voice.openQuickCapture')}
          onPress={() => nav.navigate('QuickCapture')}
          style={{ marginBottom: spacing.sm }}
          fullWidth
          size="lg"
        />
        <Button
          title={`${t('settings.voice.openPending')}${pendingCount ? ` (${pendingCount})` : ''}`}
          variant="secondary"
          onPress={() => nav.navigate('SuggestedActionsReview')}
          style={{ marginBottom: spacing.sm }}
        />
        <Button
          title={t('settings.voice.openCheckinSettings')}
          variant="secondary"
          onPress={() => nav.navigate('SmartCheckinSettings')}
          style={{ marginBottom: spacing.sm }}
        />
        <Button
          title={t('settings.voice.openHealthSettings')}
          variant="secondary"
          onPress={() => nav.navigate('HealthIntegrationSettings')}
          style={{ marginBottom: spacing.sm }}
        />
        <Button
          title={t('settings.voice.openMemory')}
          variant="ghost"
          onPress={() => nav.navigate('AICompanionMemory')}
        />
      </ScrollView>
    </Screen>
  );
}
