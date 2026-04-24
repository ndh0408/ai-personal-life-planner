import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Card, Loading, ErrorView, MoneyCard, ProgressCard } from '../../components/ui';
import {
  walletsApi,
  budgetsApi,
  debtsApi,
  savingGoalsApi,
} from '../../services/api/finance.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import type { RootStackParamList } from '../../navigation/types';
import { formatMoneyByLocale } from '../../utils/format';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function FinanceScreen() {
  const { colors, spacing, typography } = useTheme();
  const { t } = useTranslation();
  const translateError = useErrorMessage();
  const nav = useNavigation<Nav>();

  const wallets = useQuery({ queryKey: ['wallets'], queryFn: () => walletsApi.list() });
  const budgets = useQuery({ queryKey: ['budgets'], queryFn: () => budgetsApi.list() });
  const debts = useQuery({ queryKey: ['debts'], queryFn: () => debtsApi.list() });
  const savings = useQuery({ queryKey: ['saving-goals'], queryFn: () => savingGoalsApi.list() });

  if (wallets.isLoading || budgets.isLoading || debts.isLoading || savings.isLoading) {
    return <Loading />;
  }
  const err = wallets.error || budgets.error || debts.error || savings.error;
  if (err) {
    return <ErrorView message={translateError(err)} onRetry={() => wallets.refetch()} />;
  }

  const totalCash = (wallets.data ?? []).reduce((s, w) => s + Number(w.balance), 0);
  const currency = wallets.data?.[0]?.currency ?? 'VND';
  const iOwe = (debts.data ?? [])
    .filter((d) => d.type === 'I_OWE' && d.status === 'ACTIVE')
    .reduce((s, d) => s + (Number(d.totalAmount) - Number(d.paidAmount)), 0);

  return (
    <Screen scroll>
      <Text style={[typography.display, { color: colors.text, marginBottom: spacing.xs }]}>
        {t('finance.title')}
      </Text>
      <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.lg }]}>
        {t('finance.subtitle')}
      </Text>

      <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
        <View style={{ flex: 1 }}>
          <MoneyCard label={t('finance.totalCash')} amount={totalCash} currency={currency} tone="positive" />
        </View>
        <View style={{ flex: 1 }}>
          <MoneyCard label={t('finance.iOwe')} amount={iOwe} currency={currency} tone={iOwe > 0 ? 'warning' : 'default'} />
        </View>
      </View>

      {/* Navigation cards */}
      <View style={{ gap: spacing.md, marginBottom: spacing.xl }}>
        <NavRow label={t('nav.wallets')} sub={t('finance.walletsCount', { count: wallets.data?.length ?? 0 })} onPress={() => nav.navigate('Wallets')} />
        <NavRow label={t('nav.income')} sub={t('finance.trackIncome')} onPress={() => nav.navigate('Income')} />
        <NavRow label={t('nav.expense')} sub={t('finance.trackExpense')} onPress={() => nav.navigate('Expense')} />
        <NavRow label={t('nav.budget')} sub={t('finance.budgetsCount', { count: budgets.data?.length ?? 0 })} onPress={() => nav.navigate('Budget')} />
        <NavRow label={t('nav.debt')} sub={t('finance.debtsCount', { count: debts.data?.length ?? 0 })} onPress={() => nav.navigate('Debt')} />
        <NavRow label={t('nav.savingGoals')} sub={t('finance.savingsCount', { count: savings.data?.length ?? 0 })} onPress={() => nav.navigate('SavingGoals')} />
        <NavRow label={t('reports.monthly')} sub={t('finance.seeMonthlyReport')} onPress={() => nav.navigate('MonthlyFinanceReport')} />
      </View>

      {/* Budget usage preview */}
      {(budgets.data ?? []).length > 0 && (
        <>
          <Text style={[typography.h2, { color: colors.text, marginBottom: spacing.md }]}>
            {t('finance.budgetStatus')}
          </Text>
          <View style={{ gap: spacing.md, marginBottom: spacing.xl }}>
            {(budgets.data ?? []).slice(0, 3).map((b) => (
              <ProgressCard
                key={b.id}
                title={b.category}
                current={b.usage.spent}
                target={Number(b.amount)}
                currentLabel={`${formatMoneyByLocale(b.usage.spent, currency)} (${b.usage.usedPercent}%)`}
                subtitle={formatMoneyByLocale(b.amount, currency)}
                tone={b.usage.overThreshold ? (b.usage.usedPercent >= 100 ? 'danger' : 'warning') : 'default'}
              />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

function NavRow({ label, sub, onPress }: { label: string; sub: string; onPress: () => void }) {
  const { colors, spacing, radius, typography } = useTheme();
  return (
    <TouchableOpacity onPress={onPress}>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.bodyStrong, { color: colors.text }]}>{label}</Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
              {sub}
            </Text>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 20 }}>›</Text>
        </View>
      </Card>
    </TouchableOpacity>
  );
}
