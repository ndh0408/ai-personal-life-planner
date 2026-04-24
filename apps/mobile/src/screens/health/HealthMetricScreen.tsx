import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Input, Button, Card, Loading } from '../../components/ui';
import { healthMetricsApi, type HealthMetric } from '../../services/api/health.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { todayIso } from '../../utils/format';

/**
 * Log-or-update today's metrics. Backend has no upsert-by-date for
 * HealthMetric, so the client reads today's row (if any) and switches
 * between POST and PUT.
 */
export function HealthMetricScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const { t } = useTranslation();
  const translateError = useErrorMessage();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const today = todayIso();

  const existingQ = useQuery({
    queryKey: ['health-metrics', today],
    queryFn: () => healthMetricsApi.list({ from: today, to: today }),
  });
  const existing: HealthMetric | undefined = existingQ.data?.[0];

  const [weight, setWeight] = useState('');
  const [water, setWater] = useState('');
  const [steps, setSteps] = useState('');
  const [exercise, setExercise] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setWeight(existing.weightKg !== null ? String(existing.weightKg) : '');
    setWater(existing.waterIntakeMl !== null ? String(existing.waterIntakeMl) : '');
    setSteps(existing.steps !== null ? String(existing.steps) : '');
    setExercise(existing.exerciseMinutes !== null ? String(existing.exerciseMinutes) : '');
    setNote(existing.note ?? '');
  }, [existing]);

  const numeric = (s: string): number | undefined => {
    if (!s.trim()) return undefined;
    const v = Number(s);
    return Number.isFinite(v) && v >= 0 ? v : undefined;
  };

  const validate = (): boolean => {
    // Reject explicitly-non-numeric strings (non-empty but parses to NaN).
    for (const [key, val] of Object.entries({ weight, water, steps, exercise })) {
      if (!val.trim()) continue;
      const n = Number(val);
      if (!Number.isFinite(n) || n < 0) {
        Alert.alert(t('healthMetric.invalid', { field: t(`healthMetric.form.${key}`) }));
        return false;
      }
    }
    return true;
  };

  const onSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const body = {
        date: today,
        weightKg: numeric(weight),
        waterIntakeMl: numeric(water) ? Math.round(numeric(water)!) : undefined,
        steps: numeric(steps) ? Math.round(numeric(steps)!) : undefined,
        exerciseMinutes: numeric(exercise) ? Math.round(numeric(exercise)!) : undefined,
        note: note.trim() || undefined,
      };
      if (existing) {
        await healthMetricsApi.update(existing.id, body);
      } else {
        await healthMetricsApi.create(body);
      }
      queryClient.invalidateQueries({ queryKey: ['health-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      navigation.goBack();
    } catch (e) {
      Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e));
    } finally {
      setSaving(false);
    }
  };

  if (existingQ.isLoading) return <Loading />;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.xs }]}>
          {t('healthMetric.title')}
        </Text>
        <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.lg }]}>
          {t('healthMetric.subtitle')}
        </Text>

        <Card style={{ marginBottom: spacing.md }}>
          <View style={{ gap: spacing.md }}>
            <Input
              label={t('healthMetric.form.weight')}
              placeholder="68"
              value={weight}
              onChangeText={(v) => setWeight(v.replace(/[^\d.]/g, ''))}
              keyboardType="decimal-pad"
            />
            <Input
              label={t('healthMetric.form.water')}
              placeholder="2000"
              value={water}
              onChangeText={(v) => setWater(v.replace(/[^\d]/g, ''))}
              keyboardType="number-pad"
            />
            <Input
              label={t('healthMetric.form.steps')}
              placeholder="8000"
              value={steps}
              onChangeText={(v) => setSteps(v.replace(/[^\d]/g, ''))}
              keyboardType="number-pad"
            />
            <Input
              label={t('healthMetric.form.exercise')}
              placeholder="30"
              value={exercise}
              onChangeText={(v) => setExercise(v.replace(/[^\d]/g, ''))}
              keyboardType="number-pad"
            />
            <Input
              label={t('healthMetric.form.note')}
              placeholder={t('healthMetric.form.notePlaceholder')}
              value={note}
              onChangeText={setNote}
              multiline
            />
          </View>
        </Card>

        <Text style={[typography.small, { color: colors.textMuted, marginBottom: spacing.lg }]}>
          {t('healthMetric.disclaimer')}
        </Text>

        <Button
          title={
            saving
              ? t('common.loading')
              : existing
                ? t('healthMetric.update')
                : t('common.save')
          }
          onPress={onSave}
          disabled={saving}
        />
      </ScrollView>
    </Screen>
  );
}
