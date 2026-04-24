import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { Screen, Button, Chip, Card, Input } from '../../components/ui';
import { sleepApi, moodApi } from '../../services/api/sleep-mood.api';
import { todayIso } from '../../utils/format';

const QUALITY = ['VERY_BAD', 'BAD', 'NORMAL', 'GOOD', 'VERY_GOOD'] as const;
const MOODS = ['HAPPY', 'NORMAL', 'STRESSED', 'TIRED', 'SAD', 'MOTIVATED'] as const;
const ENERGY = ['LOW', 'MEDIUM', 'HIGH'] as const;
const STRESS = ['LOW', 'MEDIUM', 'HIGH'] as const;

export function SleepMoodCheckinScreen() {
  const { colors, spacing } = useTheme();
  const navigation = useNavigation();
  const today = todayIso();
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  const [quality, setQuality] = useState<typeof QUALITY[number]>('GOOD');
  const [sleepHHMM, setSleepHHMM] = useState('22:30');
  const [wakeHHMM, setWakeHHMM] = useState('06:30');
  const [mood, setMood] = useState<typeof MOODS[number]>('NORMAL');
  const [energy, setEnergy] = useState<typeof ENERGY[number]>('MEDIUM');
  const [stress, setStress] = useState<typeof STRESS[number]>('LOW');
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    setSaving(true);
    try {
      const sleepIso = `${yesterday}T${sleepHHMM}:00.000Z`;
      const wakeIso = `${today}T${wakeHHMM}:00.000Z`;
      await sleepApi.upsert({
        date: yesterday,
        sleepTime: sleepIso,
        wakeTime: wakeIso,
        quality,
      } as never);
      await moodApi.upsert({
        date: today,
        mood,
        energyLevel: energy,
        stressLevel: stress,
      } as never);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: spacing.md }}>
          Last night's sleep
        </Text>
        <Card style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Input label="Slept at (HH:mm)" value={sleepHHMM} onChangeText={setSleepHHMM} />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Woke at (HH:mm)" value={wakeHHMM} onChangeText={setWakeHHMM} />
            </View>
          </View>
          <Text style={{ color: colors.textMuted, marginBottom: 8 }}>Quality</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {QUALITY.map((q) => (
              <Chip key={q} label={q.replace('_', ' ')} selected={quality === q} onPress={() => setQuality(q)} />
            ))}
          </View>
        </Card>

        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: spacing.md }}>
          How are you feeling?
        </Text>
        <Card>
          <Text style={{ color: colors.textMuted, marginBottom: 8 }}>Mood</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
            {MOODS.map((m) => (
              <Chip key={m} label={m} selected={mood === m} onPress={() => setMood(m)} />
            ))}
          </View>
          <Text style={{ color: colors.textMuted, marginBottom: 8 }}>Energy</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
            {ENERGY.map((e) => (
              <Chip key={e} label={e} selected={energy === e} onPress={() => setEnergy(e)} />
            ))}
          </View>
          <Text style={{ color: colors.textMuted, marginBottom: 8 }}>Stress</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {STRESS.map((s) => (
              <Chip key={s} label={s} selected={stress === s} onPress={() => setStress(s)} />
            ))}
          </View>
        </Card>
      </ScrollView>
      <Button title="Save check-in" size="lg" fullWidth loading={saving} onPress={onSave} />
    </Screen>
  );
}
