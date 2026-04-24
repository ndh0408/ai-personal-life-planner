import React, { useState } from 'react';
import { Alert, ScrollView, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Input, Button, Chip } from '../../components/ui';
import { incomesApi, walletsApi } from '../../services/api/finance.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { todayIso } from '../../utils/format';
import { parseMoneyInput } from '../../utils/money';

const CATEGORIES = ['salary', 'freelance', 'bonus', 'gift', 'other'] as const;

export function AddIncomeScreen() {
  const { colors, spacing, typography } = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation();
  const queryClient = useQueryClient();
  const translateError = useErrorMessage();

  const walletsQ = useQuery({ queryKey: ['wallets'], queryFn: () => walletsApi.list() });

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>('salary');
  const [source, setSource] = useState('');
  const [walletId, setWalletId] = useState<string | null>(null);
  const [date, setDate] = useState(todayIso());
  const [recurring, setRecurring] = useState(false);
  const [recurringRule, setRecurringRule] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const parsed = parseMoneyInput(amount);
    if (!title.trim() || !parsed || parsed <= 0) {
      Alert.alert(t('incomes.invalid.title'), t('incomes.invalid.body'));
      return;
    }
    setSaving(true);
    try {
      await incomesApi.create({
        title: title.trim(),
        amount: parsed,
        category: category || undefined,
        source: source.trim() || undefined,
        incomeDate: date,
        walletId: walletId ?? undefined,
        isRecurring: recurring,
        note: undefined,
        recurringRule: recurring && recurringRule.trim() ? recurringRule.trim() : undefined,
      } as never);
      queryClient.invalidateQueries({ queryKey: ['incomes'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
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
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.lg }]}>
          {t('incomes.createTitle')}
        </Text>

        <View style={{ gap: spacing.md }}>
          <Input
            label={t('incomes.form.amount')}
            placeholder="0"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
          <Input
            label={t('incomes.form.title')}
            placeholder={t('incomes.form.titlePlaceholder')}
            value={title}
            onChangeText={setTitle}
          />
          <View>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
              {t('incomes.form.category')}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
              {CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  label={t(`incomes.categories.${c}`)}
                  selected={category === c}
                  onPress={() => setCategory(c)}
                />
              ))}
            </View>
          </View>
          <Input
            label={t('incomes.form.source')}
            placeholder={t('incomes.form.sourcePlaceholder')}
            value={source}
            onChangeText={setSource}
          />
          <View>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
              {t('incomes.form.wallet')}
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
          </View>
          <Input
            label={t('incomes.form.date')}
            placeholder="YYYY-MM-DD"
            value={date}
            onChangeText={setDate}
            autoCapitalize="none"
          />
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyStrong, { color: colors.text }]}>
                {t('incomes.form.recurring')}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                {t('incomes.form.recurringHint')}
              </Text>
            </View>
            <Switch value={recurring} onValueChange={setRecurring} />
          </View>
          {recurring ? (
            <Input
              label={t('incomes.form.recurringRule')}
              placeholder="monthly-on-5th"
              value={recurringRule}
              onChangeText={setRecurringRule}
              autoCapitalize="none"
            />
          ) : null}
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
