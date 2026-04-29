import React, { useMemo, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppScreen,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  LoadingState,
  MoneyInput,
  Text,
  TextField,
  useToast,
} from '../../components/ui';
import { spacing } from '../../theme';
import { journalService, type MealType } from '../../services/api/journal.service';
import { MealRowCard } from '../../components/today/MealRowCard';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'MealLog'>;

const MEAL_TYPES: MealType[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];

/**
 * Pick the meal type that matches the user's current local hour. Lets the user
 * skip the chip tap on the common case (you're logging the meal you just ate).
 */
function defaultMealType(): MealType {
  const h = new Date().getHours();
  if (h < 10) return 'BREAKFAST';
  if (h < 14) return 'LUNCH';
  if (h < 17) return 'SNACK';
  return 'DINNER';
}

export function MealLogScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [mealType, setMealType] = useState<MealType>(defaultMealType());
  const [cost, setCost] = useState(0);

  const list = useQuery({ queryKey: ['meals', 'today'], queryFn: () => journalService.meals('today') });

  const loggedAtIso = useMemo(() => new Date().toISOString(), []);

  const create = useMutation({
    mutationFn: () =>
      journalService.createMeal({
        title: title.trim(),
        mealType,
        cost: cost > 0 ? cost : null,
        loggedAtIso,
      }),
    onSuccess: () => {
      toast.show(t('meals.added'), 'success');
      setTitle('');
      setCost(0);
      qc.invalidateQueries({ queryKey: ['meals'] });
    },
    onError: (e) => toast.show((e as Error).message, 'danger'),
  });

  const canSubmit = title.trim().length > 0 && !create.isPending;
  const refreshing = list.isFetching && !list.isLoading;

  return (
    <AppScreen
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => list.refetch()} />}
    >
      <Text variant="kicker">{t('meals.kicker')}</Text>
      <Text variant="display" style={{ marginTop: spacing.md, marginBottom: spacing.xl }}>
        {t('meals.title')}
      </Text>

      <Card style={{ gap: spacing.lg, marginBottom: spacing.xl }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {MEAL_TYPES.map((m) => (
            <Chip
              key={m}
              label={t(`capture.mealTypes.${m}`)}
              tone="accent"
              selected={mealType === m}
              onPress={() => setMealType(m)}
            />
          ))}
        </View>
        <TextField
          label={t('meals.fields.title')}
          value={title}
          onChangeText={setTitle}
          placeholder={t('meals.placeholders.title')}
          autoFocus
        />
        <MoneyInput label={t('meals.fields.cost')} value={cost} onChange={setCost} />
        <Button
          label={create.isPending ? t('common.loading') : t('meals.saveCta')}
          onPress={() => create.mutate()}
          disabled={!canSubmit}
          loading={create.isPending}
        />
      </Card>

      <Text variant="kicker" style={{ marginBottom: spacing.sm }}>
        {t('meals.todayList')}
      </Text>
      {list.isLoading ? <LoadingState /> : null}
      {list.isError ? <ErrorState onRetry={() => list.refetch()} /> : null}
      {list.data && list.data.rows.length === 0 ? <EmptyState title={t('meals.empty')} /> : null}

      <View style={{ gap: spacing.md, marginBottom: spacing.xl }}>
        {list.data?.rows.map((r) => <MealRowCard key={r.id} row={r} />)}
      </View>

      <Button label={t('common.back')} variant="ghost" onPress={() => navigation.goBack()} />
    </AppScreen>
  );
}

