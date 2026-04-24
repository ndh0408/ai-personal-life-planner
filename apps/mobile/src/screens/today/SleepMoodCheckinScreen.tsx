import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Button, Chip, Card, Input, Loading } from '../../components/ui';
import { sleepApi, moodApi, type SleepLog, type MoodLog } from '../../services/api/sleep-mood.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { todayIso } from '../../utils/format';

const QUALITY = ['VERY_BAD', 'BAD', 'NORMAL', 'GOOD', 'VERY_GOOD'] as const;
const MOODS = ['HAPPY', 'NORMAL', 'STRESSED', 'TIRED', 'SAD', 'MOTIVATED'] as const;
const ENERGY = ['LOW', 'MEDIUM', 'HIGH'] as const;
const STRESS = ['LOW', 'MEDIUM', 'HIGH'] as const;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function parseHhmm(v: string): { h: number; m: number } | null {
  if (!HHMM.test(v)) return null;
  const [h, m] = v.split(':').map(Number);
  return { h, m };
}

/**
 * Compose ISO timestamps for the sleep pair. If the user slept late
 * (sleep hour > wake hour) we anchor sleep to the previous calendar day
 * and wake to today — the typical night-into-morning flow. Same-day
 * naps (sleep < wake same day) stay on today.
 */
function composeSleepWindow(
  sleepHHMM: string,
  wakeHHMM: string,
): { date: string; sleepIso: string; wakeIso: string; durationMin: number } | null {
  const s = parseHhmm(sleepHHMM);
  const w = parseHhmm(wakeHHMM);
  if (!s || !w) return null;
  const today = todayIso();
  const prev = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const sameDay = s.h < w.h || (s.h === w.h && s.m < w.m);
  const sleepDate = sameDay ? today : prev;
  const wakeDate = today;
  const sleepIso = `${sleepDate}T${sleepHHMM}:00.000Z`;
  const wakeIso = `${wakeDate}T${wakeHHMM}:00.000Z`;
  const durationMin = Math.round(
    (new Date(wakeIso).getTime() - new Date(sleepIso).getTime()) / 60_000,
  );
  if (durationMin <= 0) return null;
  return { date: sleepDate, sleepIso, wakeIso, durationMin };
}

function normalizeHhmm(s: string): string {
  const cleaned = s.replace(/[^\d:]/g, '');
  if (cleaned.length === 4 && !cleaned.includes(':')) {
    return `${cleaned.slice(0, 2)}:${cleaned.slice(2)}`;
  }
  return cleaned;
}

function isoToHhmm(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '22:30';
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

export function SleepMoodCheckinScreen() {
  const { colors, spacing, typography } = useTheme();
  const { t } = useTranslation();
  const translateError = useErrorMessage();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const today = todayIso();
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  const todaySleepQ = useQuery({
    queryKey: ['sleep-logs', 'seed', yesterday],
    queryFn: () => sleepApi.list({ from: yesterday, to: yesterday }),
  });
  const todayMoodQ = useQuery({
    queryKey: ['mood-logs', 'seed', today],
    queryFn: () => moodApi.list({ from: today, to: today }),
  });

  const existingSleep: SleepLog | undefined = todaySleepQ.data?.[0];
  const existingMood: MoodLog | undefined = todayMoodQ.data?.[0];

  const [quality, setQuality] = useState<(typeof QUALITY)[number]>('GOOD');
  const [sleepHHMM, setSleepHHMM] = useState('22:30');
  const [wakeHHMM, setWakeHHMM] = useState('06:30');
  const [mood, setMood] = useState<(typeof MOODS)[number]>('NORMAL');
  const [energy, setEnergy] = useState<(typeof ENERGY)[number]>('MEDIUM');
  const [stress, setStress] = useState<(typeof STRESS)[number]>('LOW');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!existingSleep) return;
    setQuality(existingSleep.quality);
    setSleepHHMM(isoToHhmm(existingSleep.sleepTime));
    setWakeHHMM(isoToHhmm(existingSleep.wakeTime));
  }, [existingSleep]);

  useEffect(() => {
    if (!existingMood) return;
    setMood(existingMood.mood as (typeof MOODS)[number]);
    setEnergy(existingMood.energyLevel as (typeof ENERGY)[number]);
    setStress(existingMood.stressLevel as (typeof STRESS)[number]);
    setNote(existingMood.note ?? '');
  }, [existingMood]);

  const window = useMemo(
    () => composeSleepWindow(sleepHHMM, wakeHHMM),
    [sleepHHMM, wakeHHMM],
  );

  const onSave = async () => {
    if (!window) {
      Alert.alert(t('checkin.invalidTimeTitle'), t('checkin.invalidTimeBody'));
      return;
    }
    setSaving(true);
    try {
      await sleepApi.upsert({
        date: window.date,
        sleepTime: window.sleepIso,
        wakeTime: window.wakeIso,
        quality,
      } as never);
      await moodApi.upsert({
        date: today,
        mood,
        energyLevel: energy,
        stressLevel: stress,
        note: note.trim() || undefined,
      } as never);
      queryClient.invalidateQueries({ queryKey: ['sleep-logs'] });
      queryClient.invalidateQueries({ queryKey: ['mood-logs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      navigation.goBack();
    } catch (e) {
      Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e));
    } finally {
      setSaving(false);
    }
  };

  if (todaySleepQ.isLoading || todayMoodQ.isLoading) return <Loading />;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.md }]}>
          {t('checkin.sleepTitle')}
        </Text>
        <Card style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Input
                label={t('checkin.sleepTime')}
                value={sleepHHMM}
                onChangeText={(v) => setSleepHHMM(normalizeHhmm(v))}
                keyboardType="numbers-and-punctuation"
                error={HHMM.test(sleepHHMM) ? undefined : t('checkin.hhmmHint')}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label={t('checkin.wakeTime')}
                value={wakeHHMM}
                onChangeText={(v) => setWakeHHMM(normalizeHhmm(v))}
                keyboardType="numbers-and-punctuation"
                error={HHMM.test(wakeHHMM) ? undefined : t('checkin.hhmmHint')}
              />
            </View>
          </View>
          {window ? (
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>
              {t('checkin.durationHint', { hours: (window.durationMin / 60).toFixed(1) })}
              {window.date !== today ? ` · ${t('checkin.spansPrevDay')}` : ''}
            </Text>
          ) : (
            <Text style={[typography.caption, { color: colors.danger, marginBottom: spacing.sm }]}>
              {t('checkin.invalidTimeBody')}
            </Text>
          )}
          <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
            {t('checkin.quality')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {QUALITY.map((q) => (
              <Chip
                key={q}
                label={t(`health.sleepSummary.quality.${q}`)}
                selected={quality === q}
                onPress={() => setQuality(q)}
              />
            ))}
          </View>
        </Card>

        <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.md }]}>
          {t('checkin.moodTitle')}
        </Text>
        <Card>
          <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
            {t('checkin.mood')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
            {MOODS.map((m) => (
              <Chip
                key={m}
                label={t(`checkin.moods.${m}`)}
                selected={mood === m}
                onPress={() => setMood(m)}
              />
            ))}
          </View>
          <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
            {t('checkin.energy')}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
            {ENERGY.map((e) => (
              <Chip
                key={e}
                label={t(`checkin.levels.${e}`)}
                selected={energy === e}
                onPress={() => setEnergy(e)}
              />
            ))}
          </View>
          <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
            {t('checkin.stress')}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
            {STRESS.map((s) => (
              <Chip
                key={s}
                label={t(`checkin.levels.${s}`)}
                selected={stress === s}
                onPress={() => setStress(s)}
              />
            ))}
          </View>
          <Input
            label={t('checkin.note')}
            placeholder={t('checkin.notePlaceholder')}
            value={note}
            onChangeText={setNote}
            multiline
          />
        </Card>

        <Button
          title={
            saving
              ? t('common.loading')
              : existingSleep || existingMood
                ? t('checkin.update')
                : t('common.save')
          }
          onPress={onSave}
          disabled={saving || !window}
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>
    </Screen>
  );
}
