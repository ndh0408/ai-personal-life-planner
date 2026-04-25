import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Card, Button, Chip } from '../../components/ui';
import { voiceCompanionApi } from '../../services/api/voice-companion.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';

const MOODS = ['HAPPY', 'NORMAL', 'STRESSED', 'TIRED', 'SAD', 'MOTIVATED'] as const;
const LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;
type Mood = (typeof MOODS)[number];
type Level = (typeof LEVELS)[number];

export function MoodQuickLogScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const messageFor = useErrorMessage();
  const nav = useNavigation();

  const [mood, setMood] = useState<Mood>('NORMAL');
  const [energy, setEnergy] = useState<Level>('MEDIUM');
  const [stress, setStress] = useState<Level>('MEDIUM');

  const mut = useMutation({
    mutationFn: () =>
      voiceCompanionApi.quickMoodLog({
        date: new Date().toISOString().slice(0, 10),
        mood,
        energyLevel: energy,
        stressLevel: stress,
      }),
    onSuccess: () => nav.goBack(),
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });

  return (
    <Screen scroll>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: spacing.md }}>
          {t('settings.moodQuickLog.title')}
        </Text>

        <Text style={{ color: colors.textMuted, marginBottom: spacing.xs }}>
          {t('settings.moodQuickLog.mood')}
        </Text>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: spacing.md }}>
          {MOODS.map((m) => (
            <Chip
              key={m}
              label={t(`settings.moodQuickLog.moodOption.${m}`)}
              selected={mood === m}
              onPress={() => setMood(m)}
            />
          ))}
        </View>

        <Card style={{ marginBottom: spacing.md, gap: spacing.md }}>
          <Text style={{ color: colors.textMuted }}>{t('settings.moodQuickLog.energy')}</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {LEVELS.map((l) => (
              <Chip
                key={`e-${l}`}
                label={t(`settings.moodQuickLog.energyOption.${l}`)}
                selected={energy === l}
                onPress={() => setEnergy(l)}
              />
            ))}
          </View>
          <Text style={{ color: colors.textMuted }}>{t('settings.moodQuickLog.stress')}</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {LEVELS.map((l) => (
              <Chip
                key={`s-${l}`}
                label={t(`settings.moodQuickLog.energyOption.${l}`)}
                selected={stress === l}
                onPress={() => setStress(l)}
              />
            ))}
          </View>
        </Card>

        <Button
          title={t('settings.moodQuickLog.save')}
          onPress={() => mut.mutate()}
          loading={mut.isPending}
          fullWidth
          size="lg"
        />
      </ScrollView>
    </Screen>
  );
}
