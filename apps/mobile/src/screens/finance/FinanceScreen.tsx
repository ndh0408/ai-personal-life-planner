import React from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import {
  Card,
  Loading,
  ErrorView,
  MoneyCard,
  ProgressCard,
  Badge,
  Button,
} from '../../components/ui';
import { walletsApi, budgetsApi, debtsApi, savingGoalsApi } from '../../services/api/finance.api';
import { dashboardApi } from '../../services/api/dashboard.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { formatMoneyByLocale } from '../../utils/format';
import { toNumber } from '../../utils/money';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function FinanceScreen() {
  const { colors, spacing, typography } = useTheme();
  const { t } = useTranslation();
  const translateError = useErrorMessage();
  const nav = useNavigation<Nav>();

  const dashQ = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => dashboardApi.summary(),
  });
  const walletsQ = useQuery({ queryKey: ['wallets'], queryFn: () => walletsApi.list() });
  const budgetsQ = useQuery({ queryKey: ['budgets'], queryFn: () => budgetsApi.list() });
  const debtsQ = useQuery({ queryKey: ['debts'], queryFn: () => debtsApi.list() });
  const savingsQ = useQuery({ queryKey: ['saving-goals'], queryFn: () => savingGoalsApi.list() });

  const refreshing =
    dashQ.isRefetching ||
    walletsQ.isRefetching ||
    budgetsQ.isRefetching ||
    debtsQ.isRefetching ||
    savingsQ.isRefetching;

  if (
    (dashQ.isLoading || walletsQ.isLoading) &&
    !dashQ.data &&
    !walletsQ.data
  ) {
    return <Loading />;
  }
  const err = dashQ.error || walletsQ.error || budgetsQ.error || debtsQ.error || savingsQ.error;
  if (err && !dashQ.data) {
    return <ErrorView message={translateError(err)} onRetry={() => dashQ.refetch()} />;
  }

  const dash = dashQ.data;
  const wallets = walletsQ.data ?? [];
  const budgets = budgetsQ.data ?? [];
  const debts = debtsQ.data ?? [];
  const savings = savingsQ.data ?? [];

  const currency = dash?.finance.currency ?? wallets[0]?.currency ?? 'VND';
  const totalCash = wallets.reduce((s, w) => s + toNumber(w.balance), 0);
  const totalIncome = dash?.finance.totalIncome ?? 0;
  const totalExpense = dash?.finance.totalExpense ?? 0;
  const remaining = dash?.finance.remaining ?? 0;
  const savingsRate = totalIncome > 0 ? Math.max(0, Math.round((remaining / totalIncome) * 100)) : 0;
  const iOwe = debts
    .filter((d) => d.type === 'I_OWE' && d.status === 'ACTIVE')
    .reduce((s, d) => s + (toNumber(d.totalAmount) - toNumber(d.paidAmount)), 0);
  const owedToMe = debts
    .filter((d) => d.type === 'OWED_TO_ME' && d.status === 'ACTIVE')
    .reduce((s, d) => s + (toNumber(d.totalAmount) - toNumber(d.paidAmount)), 0);
  const savingAvgPercent = savings.length
    ? Math.round(
        savings.reduce((s, g) => {
          const tgt = toNumber(g.targetAmount);
          const cur = toNumber(g.currentAmount);
          return s + (tgt > 0 ? (cur / tgt) * 100 : 0);
        }, 0) / savings.length,
      )
    : 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxl }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            dashQ.refetch();
            walletsQ.refetch();
            budgetsQ.refetch();
            debtsQ.refetch();
            savingsQ.refetch();
          }}
        />
      }
    >
      <Text style={[typography.display, { color: colors.text, marginBottom: spacing.xs }]}>
        {t('finance.title')}
      </Text>
      <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.lg }]}>
        {t('finance.subtitle')}
      </Text>

      {/* 1. MONTH OVERVIEW */}
      <SectionHeader title={t('finance.overview.title')} />
      <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
        <View style={{ flex: 1 }}>
          <MoneyCard label={t('finance.overview.income')} amount={totalIncome} currency={currency} tone="positive" />
        </View>
        <View style={{ flex: 1 }}>
          <MoneyCard label={t('finance.overview.expense')} amount={totalExpense} currency={currency} tone="warning" />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
        <View style={{ flex: 1 }}>
          <MoneyCard
            label={t('finance.overview.remaining')}
            amount={remaining}
            currency={currency}
            tone={remaining >= 0 ? 'positive' : 'danger'}
            hint={t('finance.overview.savingsRate', { pct: savingsRate })}
          />
        </View>
        <View style={{ flex: 1 }}>
          <MoneyCard
            label={t('finance.overview.cash')}
            amount={totalCash}
            currency={currency}
            hint={t('finance.walletsCount', { count: wallets.length })}
          />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
        <View style={{ flex: 1 }}>
          <MoneyCard
            label={t('finance.overview.iOwe')}
            amount={iOwe}
            currency={currency}
            tone={iOwe > 0 ? 'warning' : 'default'}
          />
        </View>
        <View style={{ flex: 1 }}>
          <MoneyCard
            label={t('finance.overview.owedToMe')}
            amount={owedToMe}
            currency={currency}
            tone={owedToMe > 0 ? 'positive' : 'default'}
          />
        </View>
      </View>
      <Button
        title={t('finance.overview.analyzeMonth')}
        onPress={() => nav.navigate('MonthlyFinanceReport')}
      />

      {/* Budget warnings inline */}
      {dash?.finance.budgetWarnings.length ? (
        <>
          <SectionHeader title={t('finance.budgetStatus')} onViewMore={() => nav.navigate('Budget')} />
          <View style={{ gap: spacing.sm }}>
            {dash.finance.budgetWarnings.map((b) => (
              <Card key={b.category}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    marginBottom: spacing.xs,
                  }}
                >
                  <Badge tone={b.usedPercent >= 100 ? 'danger' : 'warning'}>
                    {`${b.usedPercent}%`}
                  </Badge>
                  <Text style={[typography.bodyStrong, { color: colors.text }]}>{b.category}</Text>
                </View>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {formatMoneyByLocale(b.spent, currency)} / {formatMoneyByLocale(b.amount, currency)}
                </Text>
              </Card>
            ))}
          </View>
        </>
      ) : null}

      {/* 2. WALLETS preview */}
      <SectionHeader title={t('finance.wallets.title')} onViewMore={() => nav.navigate('Wallets')} />
      {wallets.length === 0 ? (
        <EmptyRow
          text={t('wallets.empty.title')}
          cta={t('finance.addWallet')}
          onPress={() => nav.navigate('AddWallet' as never)}
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {wallets.slice(0, 3).map((w) => (
            <Card key={w.id}>
              <View
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <View>
                  <Text style={[typography.bodyStrong, { color: colors.text }]}>{w.name}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                    {w.type}
                  </Text>
                </View>
                <Text style={[typography.h2, { color: colors.text }]}>
                  {formatMoneyByLocale(w.balance, w.currency)}
                </Text>
              </View>
            </Card>
          ))}
        </View>
      )}

      {/* Quick-nav grid */}
      <SectionHeader title={t('finance.manage')} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <NavTile icon="💸" label={t('nav.expense')} onPress={() => nav.navigate('Expense')} />
        <NavTile icon="💰" label={t('nav.income')} onPress={() => nav.navigate('Income')} />
        <NavTile icon="📊" label={t('nav.budget')} onPress={() => nav.navigate('Budget')} />
        <NavTile icon="🧾" label={t('nav.debt')} onPress={() => nav.navigate('Debt')} />
        <NavTile icon="🎯" label={t('nav.savingGoals')} onPress={() => nav.navigate('SavingGoals')} />
        <NavTile icon="📅" label={t('reports.monthly')} onPress={() => nav.navigate('MonthlyFinanceReport')} />
      </View>

      {/* Saving goals preview */}
      {savings.length > 0 ? (
        <>
          <SectionHeader
            title={t('finance.savingTop')}
            onViewMore={() => nav.navigate('SavingGoals')}
          />
          <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>
            {t('finance.savingAvg', { pct: savingAvgPercent })}
          </Text>
          <View style={{ gap: spacing.md }}>
            {savings.slice(0, 2).map((g) => (
              <ProgressCard
                key={g.id}
                title={g.title}
                current={toNumber(g.currentAmount)}
                target={toNumber(g.targetAmount)}
                currentLabel={`${formatMoneyByLocale(g.currentAmount, currency)} / ${formatMoneyByLocale(g.targetAmount, currency)}`}
              />
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function SectionHeader({ title, onViewMore }: { title: string; onViewMore?: () => void }) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: spacing.xl,
        marginBottom: spacing.md,
      }}
    >
      <Text style={[typography.h2, { color: colors.text }]}>{title}</Text>
      {onViewMore ? (
        <TouchableOpacity onPress={onViewMore}>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>{t('common.viewMore')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function NavTile({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const { colors, spacing, radius, typography } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        width: '30%',
        padding: spacing.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: 24 }}>{icon}</Text>
      <Text
        style={[typography.small, { color: colors.text, marginTop: spacing.xs, textAlign: 'center' }]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function EmptyRow({ text, cta, onPress }: { text: string; cta: string; onPress: () => void }) {
  const { colors, spacing, radius, typography } = useTheme();
  return (
    <Card>
      <Text style={{ color: colors.textMuted }}>{text}</Text>
      <TouchableOpacity
        onPress={onPress}
        style={{
          marginTop: spacing.sm,
          alignSelf: 'flex-start',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radius.md,
          backgroundColor: colors.primary,
        }}
      >
        <Text style={[typography.bodyStrong, { color: colors.textInverse }]}>{cta}</Text>
      </TouchableOpacity>
    </Card>
  );
}
