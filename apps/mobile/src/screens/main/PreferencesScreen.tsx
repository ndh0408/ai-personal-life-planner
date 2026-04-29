/**
 * "Help LifeOS understand you" — preferences pane that surfaces the round-18
 * profile expansion (dislikes / allergies / monthly goal / work pattern /
 * budget). All fields are optional; the AI behaviour gracefully degrades when
 * something isn't set.
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppHeader,
  AppScreen,
  Button,
  Card,
  Chip,
  MoneyInput,
  Text,
  TextField,
  useToast,
} from '../../components/ui';
import { spacing } from '../../theme';
import { profileService, type WorkPattern } from '../../services/api/profile.service';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Preferences'>;

const WORK_PATTERNS: WorkPattern[] = ['morning', 'evening', 'night-owl', 'flexible'];

export function PreferencesScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();

  const profile = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => profileService.get(),
  });

  // Local form state, hydrated once from server.
  const [dislikesText, setDislikesText] = useState('');
  const [allergiesText, setAllergiesText] = useState('');
  const [monthlyGoal, setMonthlyGoal] = useState('');
  const [workPattern, setWorkPattern] = useState<WorkPattern | null>(null);
  const [budget, setBudget] = useState(0);

  useEffect(() => {
    if (!profile.data) return;
    setDislikesText(profile.data.dislikes.join(', '));
    setAllergiesText(profile.data.allergies.join(', '));
    setMonthlyGoal(profile.data.monthlyGoal ?? '');
    setWorkPattern(profile.data.workPattern);
    setBudget(profile.data.budgetMonthly ?? 0);
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () =>
      profileService.update({
        dislikes: parseList(dislikesText),
        allergies: parseList(allergiesText),
        monthlyGoal: monthlyGoal.trim() || null,
        workPattern,
        budgetMonthly: budget > 0 ? budget : null,
      }),
    onSuccess: () => {
      toast.show(t('preferences.saved'), 'success');
      qc.invalidateQueries({ queryKey: ['profile'] });
      navigation.goBack();
    },
    onError: (e) => toast.show((e as Error).message, 'danger'),
  });

  return (
    <AppScreen>
      <AppHeader
        kicker={t('preferences.kicker')}
        title={t('preferences.title')}
        onBack={() => navigation.goBack()}
      />
      <Text style={{ marginBottom: spacing.xl, opacity: 0.7 }}>{t('preferences.subtitle')}</Text>

      <Card style={{ gap: spacing.lg }}>
        <View>
          <Text variant="kicker" style={{ marginBottom: spacing.xs }}>
            {t('preferences.fields.workPattern')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {WORK_PATTERNS.map((p) => (
              <Chip
                key={p}
                label={t(`preferences.workPatterns.${p}`)}
                tone="accent"
                selected={workPattern === p}
                onPress={() => setWorkPattern(p)}
              />
            ))}
          </View>
        </View>

        <TextField
          label={t('preferences.fields.monthlyGoal')}
          value={monthlyGoal}
          onChangeText={setMonthlyGoal}
          placeholder={t('preferences.placeholders.monthlyGoal')}
          multiline
        />

        <MoneyInput
          label={t('preferences.fields.budget')}
          value={budget}
          onChange={setBudget}
          placeholder="0"
        />

        <TextField
          label={t('preferences.fields.dislikes')}
          value={dislikesText}
          onChangeText={setDislikesText}
          placeholder={t('preferences.placeholders.dislikes')}
          hint={t('preferences.hints.commaSeparated')}
        />

        <TextField
          label={t('preferences.fields.allergies')}
          value={allergiesText}
          onChangeText={setAllergiesText}
          placeholder={t('preferences.placeholders.allergies')}
          hint={t('preferences.hints.commaSeparated')}
        />
      </Card>

      <View style={{ height: spacing.xl }} />
      <Button
        label={save.isPending ? t('common.loading') : t('common.save')}
        onPress={() => save.mutate()}
        disabled={save.isPending}
        loading={save.isPending}
      />
      <View style={{ height: spacing.sm }} />
      <Button label={t('common.cancel')} variant="ghost" onPress={() => navigation.goBack()} />
    </AppScreen>
  );
}

function parseList(s: string): string[] {
  return s
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
    .slice(0, 40);
}
