import React, { useState } from 'react';
import { Alert, ScrollView, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Card, Button, Input, Chip } from '../../components/ui';
import { voiceCompanionApi } from '../../services/api/voice-companion.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';

const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const;
type MealType = (typeof MEAL_TYPES)[number];

export function MealQuickLogScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const messageFor = useErrorMessage();
  const nav = useNavigation();

  const [mealType, setMealType] = useState<MealType>('LUNCH');
  const [title, setTitle] = useState('');
  const [cost, setCost] = useState('');
  const [calories, setCalories] = useState('');
  const [alsoExpense, setAlsoExpense] = useState(false);

  const mut = useMutation({
    mutationFn: () =>
      voiceCompanionApi.quickMealLog({
        date: new Date().toISOString().slice(0, 10),
        mealType,
        title: title.trim(),
        estimatedCost: cost ? Number(cost) : undefined,
        estimatedCalories: calories ? Number(calories) : undefined,
        alsoCreateExpense: alsoExpense,
      }),
    onSuccess: () => nav.goBack(),
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });

  return (
    <Screen scroll>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: spacing.md }}>
          {t('settings.mealQuickLog.title')}
        </Text>
        <Text style={{ color: colors.textMuted, marginBottom: spacing.xs }}>
          {t('settings.mealQuickLog.mealType')}
        </Text>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: spacing.md, flexWrap: 'wrap' }}>
          {MEAL_TYPES.map((m) => (
            <Chip
              key={m}
              label={t(`settings.mealQuickLog.mealTypeOption.${m}`)}
              selected={mealType === m}
              onPress={() => setMealType(m)}
            />
          ))}
        </View>

        <Card style={{ marginBottom: spacing.md, gap: spacing.md }}>
          <Input
            label={t('settings.mealQuickLog.titleField')}
            value={title}
            onChangeText={setTitle}
          />
          <Input
            label={t('settings.mealQuickLog.estimatedCost')}
            value={cost}
            onChangeText={setCost}
            keyboardType="decimal-pad"
          />
          <Input
            label={t('settings.mealQuickLog.estimatedCalories')}
            value={calories}
            onChangeText={setCalories}
            keyboardType="number-pad"
          />
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text style={{ color: colors.text, flex: 1 }}>
              {t('settings.mealQuickLog.alsoCreateExpense')}
            </Text>
            <Switch value={alsoExpense} onValueChange={setAlsoExpense} />
          </View>
        </Card>

        <Button
          title={t('settings.mealQuickLog.save')}
          onPress={() => {
            if (!title.trim()) {
              Alert.alert(t('errors.VALIDATION_FAILED'));
              return;
            }
            mut.mutate();
          }}
          loading={mut.isPending}
          fullWidth
          size="lg"
        />
      </ScrollView>
    </Screen>
  );
}
