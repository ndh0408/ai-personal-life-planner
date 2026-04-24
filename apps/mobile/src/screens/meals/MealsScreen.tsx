import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import {
  Screen,
  Card,
  Button,
  Badge,
  Chip,
  Loading,
  ErrorView,
  EmptyState,
} from '../../components/ui';
import { mealsApi, type MealPlan, type MealSuggestion } from '../../services/api/meals.api';
import { mealLogsApi, type MealLog } from '../../services/api/health.api';
import { aiApi } from '../../services/api/ai.api';
import { QUERY_KEYS } from '../../constants';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import {
  formatDateByLocale,
  formatMoneyByLocale,
  todayIso,
} from '../../utils/format';

const MEAL_ORDER: Array<MealSuggestion['mealType']> = [
  'BREAKFAST',
  'LUNCH',
  'DINNER',
  'SNACK',
];

const MEAL_ICON: Record<string, string> = {
  BREAKFAST: '🌅',
  LUNCH: '🥗',
  DINNER: '🍲',
  SNACK: '🍎',
};

function shiftDays(base: string, delta: number): string {
  const d = new Date(`${base}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function MealsScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const { t } = useTranslation();
  const translateError = useErrorMessage();
  const queryClient = useQueryClient();

  const [date, setDate] = useState(todayIso());
  const [aiOpen, setAiOpen] = useState(false);

  const planQ = useQuery({
    queryKey: QUERY_KEYS.meals(date),
    queryFn: () => mealsApi.byDate(date),
  });
  const logsQ = useQuery({
    queryKey: ['meal-logs', date],
    queryFn: () => mealLogsApi.list({ from: date, to: date }),
  });

  const suggestMut = useMutation({
    mutationFn: (input: Parameters<typeof aiApi.suggestMeals>[0]) => aiApi.suggestMeals(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.meals(date) });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setAiOpen(false);
    },
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e)),
  });

  const logAteMut = useMutation({
    mutationFn: (s: MealSuggestion) =>
      mealLogsApi.create({
        date,
        mealType: s.mealType,
        title: s.title,
        estimatedCalories: s.estimatedCalories ?? undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-logs', date] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e)),
  });

  if (planQ.isLoading && !planQ.data) return <Loading />;
  if (planQ.error && !planQ.data) {
    return <ErrorView message={translateError(planQ.error)} onRetry={() => planQ.refetch()} />;
  }

  const plan: MealPlan | null = planQ.data ?? null;
  const logs: MealLog[] = logsQ.data ?? [];
  const loggedByType = new Map<string, MealLog>();
  logs.forEach((l) => loggedByType.set(l.mealType, l));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxl }}
      refreshControl={
        <RefreshControl
          refreshing={planQ.isRefetching || logsQ.isRefetching}
          onRefresh={() => {
            planQ.refetch();
            logsQ.refetch();
          }}
        />
      }
    >
      {/* Date picker row */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.md,
        }}
      >
        <TouchableOpacity
          onPress={() => setDate((d) => shiftDays(d, -1))}
          hitSlop={10}
          style={{ padding: spacing.sm }}
        >
          <Text style={[typography.h2, { color: colors.textMuted }]}>‹</Text>
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={[typography.h2, { color: colors.text }]}>
            {formatDateByLocale(date)}
          </Text>
          {date !== todayIso() ? (
            <TouchableOpacity onPress={() => setDate(todayIso())}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>
                {t('meals.backToToday')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={() => setDate((d) => shiftDays(d, 1))}
          hitSlop={10}
          style={{ padding: spacing.sm }}
        >
          <Text style={[typography.h2, { color: colors.textMuted }]}>›</Text>
        </TouchableOpacity>
      </View>

      <Text style={[typography.display, { color: colors.text, marginBottom: spacing.xs }]}>
        {t('meals.title')}
      </Text>
      <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.lg }]}>
        {t('meals.subtitle')}
      </Text>

      {/* AI CTA */}
      <Card style={{ marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.bodyStrong, { color: colors.text }]}>
              {t('meals.ai.ctaTitle')}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
              {t('meals.ai.ctaBody')}
            </Text>
          </View>
          <Button
            title={suggestMut.isPending ? t('common.loading') : t('meals.ai.cta')}
            onPress={() => setAiOpen(true)}
            disabled={suggestMut.isPending}
          />
        </View>
      </Card>

      {/* Meal plan */}
      {!plan ? (
        <EmptyState
          title={t('meals.empty.title')}
          description={t('meals.empty.description')}
        />
      ) : (
        <>
          {plan.notes ? (
            <Card style={{ marginBottom: spacing.md }}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {t('meals.notes')}
              </Text>
              <Text style={{ color: colors.text, marginTop: spacing.xs }}>{plan.notes}</Text>
            </Card>
          ) : null}
          <View style={{ gap: spacing.md }}>
            {MEAL_ORDER.map((type) => {
              const s = plan.suggestions.find((x) => x.mealType === type);
              const log = loggedByType.get(type);
              return (
                <MealBlock
                  key={type}
                  mealType={type}
                  suggestion={s ?? null}
                  log={log ?? null}
                  onLogAte={s ? () => logAteMut.mutate(s) : undefined}
                />
              );
            })}
          </View>
        </>
      )}

      {/* Estimates disclaimer */}
      <Text style={[typography.small, { color: colors.textMuted, marginTop: spacing.lg }]}>
        {t('meals.disclaimer')}
      </Text>

      {aiOpen ? (
        <AiSuggestModal
          onClose={() => setAiOpen(false)}
          onSubmit={(input) =>
            suggestMut.mutate({ ...input, date, save: true })
          }
          submitting={suggestMut.isPending}
        />
      ) : null}
    </ScrollView>
  );
}

function MealBlock({
  mealType,
  suggestion,
  log,
  onLogAte,
}: {
  mealType: MealSuggestion['mealType'];
  suggestion: MealSuggestion | null;
  log: MealLog | null;
  onLogAte?: () => void;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const { t } = useTranslation();

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
        <Text style={{ fontSize: 22 }}>{MEAL_ICON[mealType]}</Text>
        <Text style={[typography.bodyStrong, { color: colors.text }]}>
          {t(`meals.type.${mealType}`)}
        </Text>
        {log ? <Badge tone="success">{t('meals.ate')}</Badge> : null}
      </View>

      {suggestion ? (
        <>
          <Text style={[typography.h2, { color: colors.text }]} numberOfLines={2}>
            {suggestion.title}
          </Text>
          {suggestion.description ? (
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
              {suggestion.description}
            </Text>
          ) : null}
          {suggestion.ingredients.length > 0 ? (
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
              • {suggestion.ingredients.join(', ')}
            </Text>
          ) : null}
          <View
            style={{
              flexDirection: 'row',
              gap: spacing.md,
              marginTop: spacing.sm,
              flexWrap: 'wrap',
            }}
          >
            {suggestion.estimatedCalories !== null ? (
              <Stat label={t('meals.calories')} value={`~${suggestion.estimatedCalories} kcal`} />
            ) : null}
            {suggestion.prepTimeMinutes !== null ? (
              <Stat label={t('meals.prepTime')} value={`~${suggestion.prepTimeMinutes} ${t('tasks.min')}`} />
            ) : null}
          </View>
          {suggestion.reason ? (
            <Text style={[typography.small, { color: colors.textMuted, marginTop: spacing.sm }]}>
              💡 {suggestion.reason}
            </Text>
          ) : null}
          {suggestion.healthNote ? (
            <Text style={[typography.small, { color: colors.textMuted, marginTop: spacing.xs }]}>
              ⚕️ {suggestion.healthNote}
            </Text>
          ) : null}
          {!log && onLogAte ? (
            <TouchableOpacity
              onPress={onLogAte}
              style={{
                marginTop: spacing.md,
                alignSelf: 'flex-start',
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radius.pill,
                backgroundColor: colors.primary,
              }}
            >
              <Text style={{ color: colors.textInverse, fontWeight: '700' }}>
                {t('meals.logAte')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </>
      ) : (
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
          {t('meals.noneSuggested')}
        </Text>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors, typography } = useTheme();
  return (
    <View>
      <Text style={[typography.small, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[typography.bodyStrong, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

// ----- AI modal -------------------------------------------------------------

type SuggestInput = {
  goal?: string;
  budget?: string;
  availableIngredients?: string[];
  cookingTimeMinutes?: number;
};

const GOAL_OPTIONS = ['healthy', 'high-protein', 'low-carb', 'cheap', 'quick'] as const;

function AiSuggestModal({
  onClose,
  onSubmit,
  submitting,
}: {
  onClose: () => void;
  onSubmit: (input: SuggestInput) => void;
  submitting: boolean;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const { t } = useTranslation();

  const [goal, setGoal] = useState<string>('');
  const [budget, setBudget] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [cookMin, setCookMin] = useState('');

  function submit() {
    onSubmit({
      goal: goal || undefined,
      budget: budget.trim() || undefined,
      availableIngredients: ingredients
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
      cookingTimeMinutes: cookMin ? Number(cookMin) : undefined,
    });
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end',
        }}
      >
        <View
          style={{
            backgroundColor: colors.bg,
            padding: spacing.xl,
            paddingBottom: spacing.xxl,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            gap: spacing.md,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[typography.h2, { color: colors.text }]}>
              {t('meals.ai.formTitle')}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Text style={{ color: colors.textMuted, fontSize: 22 }}>✕</Text>
            </TouchableOpacity>
          </View>

          <View>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
              {t('meals.ai.goal')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {GOAL_OPTIONS.map((g) => (
                <Chip
                  key={g}
                  label={t(`meals.ai.goals.${g}`)}
                  selected={goal === g}
                  onPress={() => setGoal(goal === g ? '' : g)}
                />
              ))}
            </View>
          </View>

          <Field label={t('meals.ai.budget')} placeholder="~150k VND">
            <TextInput
              value={budget}
              onChangeText={setBudget}
              placeholder="~150k VND"
              placeholderTextColor={colors.textMuted}
              style={inputStyle(colors, radius, spacing)}
            />
          </Field>

          <Field
            label={t('meals.ai.ingredients')}
            placeholder={t('meals.ai.ingredientsPlaceholder')}
          >
            <TextInput
              value={ingredients}
              onChangeText={setIngredients}
              placeholder={t('meals.ai.ingredientsPlaceholder')}
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
              style={[
                inputStyle(colors, radius, spacing),
                { minHeight: 80, textAlignVertical: 'top' },
              ]}
            />
          </Field>

          <Field label={t('meals.ai.cookMin')} placeholder="30">
            <TextInput
              value={cookMin}
              onChangeText={(v) => setCookMin(v.replace(/[^\d]/g, ''))}
              keyboardType="number-pad"
              placeholder="30"
              placeholderTextColor={colors.textMuted}
              style={inputStyle(colors, radius, spacing)}
            />
          </Field>

          <Text style={[typography.small, { color: colors.textMuted }]}>
            {t('meals.disclaimer')}
          </Text>

          <Button
            title={submitting ? t('common.loading') : t('meals.ai.submit')}
            onPress={submit}
            disabled={submitting}
          />
        </View>
      </View>
    </Modal>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  placeholder: string;
  children: React.ReactNode;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View>
      <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function inputStyle(colors: ReturnType<typeof useTheme>['colors'], radius: ReturnType<typeof useTheme>['radius'], spacing: ReturnType<typeof useTheme>['spacing']) {
  return {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    color: colors.text,
    backgroundColor: colors.surface,
  };
}
