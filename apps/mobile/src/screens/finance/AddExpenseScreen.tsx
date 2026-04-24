import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Input, Button, Chip, Badge } from '../../components/ui';
import {
  expensesApi,
  walletsApi,
  type NeedLevel,
} from '../../services/api/finance.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { todayIso } from '../../utils/format';
import { parseMoneyInput } from '../../utils/money';

const NEED_LEVELS: NeedLevel[] = ['NEED', 'WANT', 'WASTE', 'INVESTMENT', 'SAVING'];

const QUICK_CATEGORIES = [
  { key: 'food', icon: '🍲' },
  { key: 'transport', icon: '🚕' },
  { key: 'housing', icon: '🏠' },
  { key: 'utilities', icon: '💡' },
  { key: 'shopping', icon: '🛍' },
  { key: 'entertainment', icon: '🎬' },
  { key: 'health', icon: '💊' },
  { key: 'education', icon: '📚' },
] as const;

export function AddExpenseScreen() {
  const { colors, spacing, typography } = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation();
  const queryClient = useQueryClient();
  const translateError = useErrorMessage();

  const walletsQ = useQuery({ queryKey: ['wallets'], queryFn: () => walletsApi.list() });

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('food');
  const [needLevel, setNeedLevel] = useState<NeedLevel | undefined>();
  const [walletId, setWalletId] = useState<string | null>(null);
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const parsed = parseMoneyInput(amount);
    if (!title.trim() || !parsed || parsed <= 0) {
      Alert.alert(t('expenses.invalid.title'), t('expenses.invalid.body'));
      return;
    }
    setSaving(true);
    try {
      await expensesApi.create({
        title: title.trim(),
        amount: parsed,
        category,
        expenseDate: date,
        walletId: walletId ?? undefined,
        needLevel,
        note: note.trim() || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      nav.goBack();
    } catch (e) {
      Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e));
      // Rollback isn't needed here — we never optimistically touched anything.
      // The wallet balance adjustment happens server-side in a transaction;
      // a failed create leaves the wallet untouched.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.lg }]}>
          {t('expenses.createTitle')}
        </Text>

        <View style={{ gap: spacing.md }}>
          <Input
            label={t('expenses.form.amount')}
            placeholder="0"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
          <Input
            label={t('expenses.form.title')}
            placeholder={t('expenses.form.titlePlaceholder')}
            value={title}
            onChangeText={setTitle}
          />

          <View>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
              {t('expenses.form.category')}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
              {QUICK_CATEGORIES.map((c) => (
                <Chip
                  key={c.key}
                  label={`${c.icon} ${t(`expenses.categories.${c.key}`)}`}
                  selected={category === c.key}
                  onPress={() => setCategory(c.key)}
                />
              ))}
            </View>
            <Input
              label={t('expenses.form.customCategory')}
              placeholder={t('expenses.form.customCategoryPlaceholder')}
              value={category}
              onChangeText={setCategory}
              autoCapitalize="none"
            />
          </View>

          <View>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
              {t('expenses.form.needLevel')}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              {NEED_LEVELS.map((n) => (
                <Chip
                  key={n}
                  label={t(`expenses.needLevels.${n}`)}
                  selected={needLevel === n}
                  onPress={() => setNeedLevel(needLevel === n ? undefined : n)}
                />
              ))}
            </View>
          </View>

          <View>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
              {t('expenses.form.wallet')}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              <Chip
                label={t('expenses.noWallet')}
                selected={walletId === null}
                onPress={() => setWalletId(null)}
              />
              {(walletsQ.data ?? []).map((w) => (
                <Chip
                  key={w.id}
                  label={w.name}
                  selected={walletId === w.id}
                  onPress={() => setWalletId(w.id)}
                />
              ))}
            </View>
            {walletId ? (
              <Text style={[typography.small, { color: colors.textMuted, marginTop: spacing.xs }]}>
                {t('expenses.walletWillAdjust')}
              </Text>
            ) : null}
          </View>

          <Input
            label={t('expenses.form.date')}
            placeholder="YYYY-MM-DD"
            value={date}
            onChangeText={setDate}
            autoCapitalize="none"
          />
          <Input
            label={t('expenses.form.note')}
            placeholder={t('expenses.form.notePlaceholder')}
            value={note}
            onChangeText={setNote}
            multiline
          />
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
