import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppScreen,
  Button,
  Card,
  Chip,
  Text,
  TextField,
  useToast,
} from '../../components/ui';
import { spacing } from '../../theme';
import {
  journalService,
  type Energy,
  type Mood,
  type SleepQuality,
} from '../../services/api/journal.service';
import { profileService } from '../../services/api/profile.service';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SleepMoodCheckin'>;

const SLEEP_HOURS = [5, 6, 6.5, 7, 7.5, 8, 8.5];
const SLEEP_QUALITIES: SleepQuality[] = ['BAD', 'OK', 'GOOD'];
const MOODS: Mood[] = ['GREAT', 'GOOD', 'OK', 'TIRED', 'STRESSED', 'SAD'];
const ENERGIES: Energy[] = ['LOW', 'MEDIUM', 'HIGH'];

/**
 * Parse "HH:mm" → { h, m }, falling back to 07:00 when input is invalid/missing.
 * Used to anchor the sleep window to the user's *own* usual wake time, not
 * a hardcoded 7am.
 */
function parseHHMM(s: string | null | undefined, fallbackH = 7, fallbackM = 0) {
  if (!s) return { h: fallbackH, m: fallbackM };
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return { h: fallbackH, m: fallbackM };
  return {
    h: Math.min(23, Math.max(0, Number(m[1]))),
    m: Math.min(59, Math.max(0, Number(m[2]))),
  };
}

function buildSleepWindow(
  hours: number,
  wakeTime: string | null | undefined,
): { sleepAtIso: string; wakeAtIso: string } {
  const { h, m } = parseHHMM(wakeTime);
  const wake = new Date();
  wake.setHours(h, m, 0, 0);
  const sleep = new Date(wake.getTime() - hours * 60 * 60_000);
  return { sleepAtIso: sleep.toISOString(), wakeAtIso: wake.toISOString() };
}

export function SleepMoodCheckinScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();

  // Pull profile so the wake anchor matches the user's onboarding answer.
  const profile = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => profileService.get(),
    staleTime: 60_000,
  });

  const [hours, setHours] = useState<number | null>(7);
  const [quality, setQuality] = useState<SleepQuality | null>(null);
  const [mood, setMood] = useState<Mood>('OK');
  const [energy, setEnergy] = useState<Energy>('MEDIUM');
  const [note, setNote] = useState('');

  const saveSleep = useMutation({
    mutationFn: () => {
      const { sleepAtIso, wakeAtIso } = buildSleepWindow(
        hours ?? 7,
        profile.data?.usualWakeTime ?? null,
      );
      return journalService.createSleep({
        sleepAtIso,
        wakeAtIso,
        quality,
        note: note.trim() || null,
      });
    },
  });

  const saveMood = useMutation({
    mutationFn: () =>
      journalService.createMood({
        mood,
        energy,
        loggedAtIso: new Date().toISOString(),
        note: note.trim() || null,
      }),
  });

  const submitting = saveSleep.isPending || saveMood.isPending;

  async function handleSave() {
    // Reset previous error state on each attempt — without this, retry after
    // a failure still shows the failed mutation as `isError`.
    saveSleep.reset();
    saveMood.reset();
    const tasks: Promise<unknown>[] = [];
    if (hours != null) tasks.push(saveSleep.mutateAsync());
    tasks.push(saveMood.mutateAsync());
    try {
      await Promise.all(tasks);
      toast.show(t('checkin.saved'), 'success');
      qc.invalidateQueries({ queryKey: ['sleep'] });
      qc.invalidateQueries({ queryKey: ['mood'] });
      navigation.goBack();
    } catch (e) {
      toast.show((e as Error).message, 'danger');
    }
  }

  return (
    <AppScreen>
      <Text variant="kicker">{t('checkin.kicker')}</Text>
      <Text variant="display" style={{ marginTop: spacing.md, marginBottom: spacing.xl }}>
        {t('checkin.title')}
      </Text>

      <Card style={{ gap: spacing.md, marginBottom: spacing.lg }}>
        <Text variant="kicker">{t('checkin.sleepKicker')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {SLEEP_HOURS.map((h) => (
            <Chip
              key={h}
              label={`${h}h`}
              tone="accent"
              selected={hours === h}
              onPress={() => setHours(h)}
            />
          ))}
          <Chip
            label={t('checkin.skipSleep')}
            selected={hours === null}
            onPress={() => setHours(null)}
          />
        </View>
        {hours !== null ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
            {SLEEP_QUALITIES.map((q) => (
              <Chip
                key={q}
                label={t(`checkin.qualities.${q}`)}
                tone="accent"
                selected={quality === q}
                onPress={() => setQuality(q)}
              />
            ))}
          </View>
        ) : null}
      </Card>

      <Card style={{ gap: spacing.md, marginBottom: spacing.lg }}>
        <Text variant="kicker">{t('checkin.moodKicker')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {MOODS.map((m) => (
            <Chip
              key={m}
              label={t(`capture.moods.${m}`)}
              tone="accent"
              selected={mood === m}
              onPress={() => setMood(m)}
            />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
          {ENERGIES.map((e) => (
            <Chip
              key={e}
              label={t(`checkin.energies.${e}`)}
              tone="accent"
              selected={energy === e}
              onPress={() => setEnergy(e)}
            />
          ))}
        </View>
        <TextField
          label={t('checkin.fields.note')}
          value={note}
          onChangeText={setNote}
          placeholder={t('checkin.placeholders.note')}
        />
      </Card>

      <Button
        label={submitting ? t('common.loading') : t('checkin.saveCta')}
        onPress={handleSave}
        disabled={submitting}
        loading={submitting}
      />
      <View style={{ height: spacing.sm }} />
      <Button label={t('common.cancel')} variant="ghost" onPress={() => navigation.goBack()} />
    </AppScreen>
  );
}
