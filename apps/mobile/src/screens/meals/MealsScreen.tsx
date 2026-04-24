import React from 'react';
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../theme';
import { Screen, Card, Button, Badge, Loading, ErrorView, EmptyState } from '../../components/ui';
import { mealsApi } from '../../services/api/meals.api';
import { aiApi } from '../../services/api/ai.api';
import { QUERY_KEYS } from '../../constants';
import { todayIso } from '../../utils/format';

const MEAL_TONE: Record<string, 'warning' | 'success' | 'info' | 'primary'> = {
  BREAKFAST: 'warning',
  LUNCH: 'success',
  DINNER: 'info',
  SNACK: 'primary',
};

export function MealsScreen() {
  const { colors, spacing } = useTheme();
  const date = todayIso();
  const queryClient = useQueryClient();

  const mealsQ = useQuery({
    queryKey: QUERY_KEYS.meals(date),
    queryFn: () => mealsApi.byDate(date),
  });

  const suggestMut = useMutation({
    mutationFn: () => aiApi.suggestMeals({ date, save: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meals'] }),
    onError: (e: Error) => Alert.alert('AI failed', e.message),
  });

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={mealsQ.isFetching}
            onRefresh={mealsQ.refetch}
            tintColor={colors.primary}
          />
        }
      >
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700' }}>Meals</Text>
          <Text style={{ color: colors.textMuted, marginTop: 4 }}>{date}</Text>
        </View>

        {mealsQ.isLoading ? (
          <Loading />
        ) : mealsQ.isError ? (
          <ErrorView message={(mealsQ.error as Error).message} onRetry={() => mealsQ.refetch()} />
        ) : !mealsQ.data ? (
          <EmptyState
            title="No meal plan for today"
            description="Let AI propose meals from your goal and what's in the fridge."
            actionLabel="Suggest meals"
            onAction={() => suggestMut.mutate()}
          />
        ) : (
          <View>
            {mealsQ.data.goal ? (
              <Card style={{ marginBottom: spacing.md }}>
                <Text style={{ color: colors.text, fontSize: 14 }}>Goal</Text>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginTop: 4 }}>
                  {mealsQ.data.goal}
                </Text>
              </Card>
            ) : null}
            {mealsQ.data.suggestions.map((s) => (
              <Card key={s.id} style={{ marginBottom: spacing.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', flex: 1 }}>
                    {s.title}
                  </Text>
                  <Badge tone={MEAL_TONE[s.mealType] ?? 'neutral'}>{s.mealType}</Badge>
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                  {s.ingredients.join(', ')}
                </Text>
                {s.estimatedCalories ? (
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
                    ~{s.estimatedCalories} kcal · {s.prepTimeMinutes ?? '?'} min
                  </Text>
                ) : null}
              </Card>
            ))}
            <Button
              title="Re-suggest with AI"
              variant="secondary"
              loading={suggestMut.isPending}
              onPress={() => suggestMut.mutate()}
              style={{ marginTop: spacing.md }}
            />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
