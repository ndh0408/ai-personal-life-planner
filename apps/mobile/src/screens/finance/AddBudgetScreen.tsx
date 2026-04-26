import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Input, Button, Chip } from '../../components/ui';
import { budgetsApi, type BudgetPeriod } from '../../services/api/finance.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { parseMoneyInput } from '../../utils/money';

function monthBounds(): { start: string; end: string } {
  const d = new Date();
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function weekBounds(): { start: string; end: string } {
  const now = new Date();
  const day = now.getUTCDay() || 7;
  const mon = new Date(now);
  mon.setUTCDate(now.getUTCDate() - (day - 1));
  const sun = new Date(mon);
  sun.setUTCDate(mon.getUTCDate() + 6);
  return { start: mon.toISOString().slice(0, 10), end: sun.toISOString().slice(0, 10) };
}

export function AddBudgetScreen() {
  const { colors, spacing, typography } = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation();
  const queryClient = useQueryClient();
  const translateError = useErrorMessage();

  const [category, setCategory] = useState('food');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<BudgetPeriod>('MONTHLY');
  const [threshold, setThreshold] = useState('80');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const parsed = parseMoneyInput(amount);
    if (!category.trim() || !parsed) {
      Alert.alert(t('budgets.invalid.title'), t('budgets.invalid.body'));
      return;
    }
    const { start, end } = period === 'MONTHLY' ? monthBounds() : weekBounds();
    const th = Math.max(1, Math.min(200, Number(threshold) || 80));
    setSaving(true);
    try {
      await budgetsApi.create({
        category: category.trim(),
        amount: parsed,
        period,
        startDate: start,
        endDate: end,
        alertThresholdPercent: th,
      });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      nav.goBack();
    } catch (e) {
      Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.lg }]}>
          {t('budgets.createTitle')}
        </Text>
        <View style={{ gap: spacing.md }}>
          <View>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
              {t('budgets.form.category')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm }}>
              {(['food', 'transport', 'housing', 'utilities', 'shopping', 'entertainment', 'health', 'education'] as const).map((c) => (
                <Chip
                  key={c}
                  label={t(`expenses.categories.${c}`, { defaultValue: c })}
                  selected={category === c}
                  onPress={() => setCategory(c)}
                />
              ))}
            </View>
            <Input
              label={t('expenses.form.customCategory', { defaultValue: 'Custom category' })}
              placeholder="food"
              value={category}
              onChangeText={setCategory}
              autoCapitalize="none"
            />
          </View>
          <Input
            label={t('budgets.form.amount')}
            placeholder="3000000"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
          <View>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
              {t('budgets.form.period')}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {(['MONTHLY', 'WEEKLY'] as BudgetPeriod[]).map((p) => (
                <Chip
                  key={p}
                  label={t(`budgets.periods.${p}`)}
                  selected={period === p}
                  onPress={() => setPeriod(p)}
                />
              ))}
            </View>
          </View>
          <Input
            label={t('budgets.form.threshold')}
            placeholder="80"
            value={threshold}
            onChangeText={(v) => setThreshold(v.replace(/[^\d]/g, ''))}
            keyboardType="number-pad"
          />
          <Text style={[typography.small, { color: colors.textMuted }]}>
            {t('budgets.thresholdHint')}
          </Text>
        </View>
        <Button
          title={saving ? t('common.loading') : t('common.save')}
          onPress={submit}
          disabled={saving}
          style={{ marginTop: spacing.xl }}
        />
      </ScrollView>
    </Screen>
  );
}
