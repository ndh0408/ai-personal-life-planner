import React, { useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import {
  Screen,
  Card,
  Button,
  Badge,
  Loading,
  ErrorView,
  EmptyState,
  MoneyCard,
  ProgressCard,
} from '../../components/ui';
import {
  reportsApi,
  type MonthlyFinanceReport,
} from '../../services/api/reports.api';
import { aiApi, type FinanceAnalysisResponse } from '../../services/api/ai.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { formatMoneyByLocale, formatDateByLocale } from '../../utils/format';

function currentMonthTag(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function MonthlyFinanceReportScreen() {
  const { colors, spacing, typography } = useTheme();
  const { t } = useTranslation();
  const translateError = useErrorMessage();
  const month = currentMonthTag();

  const reportQ = useQuery({
    queryKey: ['reports', 'monthly-finance', month],
    queryFn: () => reportsApi.monthlyFinance(month),
  });

  const [aiResult, setAiResult] = useState<FinanceAnalysisResponse['analysis'] | null>(null);
  const aiMut = useMutation({
    mutationFn: () => aiApi.analyzeFinance({ month }),
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e)),
    onSuccess: (res) => setAiResult(res.analysis),
  });

  const topCategories = useMemo(() => {
    if (!reportQ.data) return [] as Array<[string, number]>;
    return Object.entries(reportQ.data.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [reportQ.data]);

  if (reportQ.isLoading) return <Loading />;
  if (reportQ.error) {
    return <ErrorView message={translateError(reportQ.error)} onRetry={() => reportQ.refetch()} />;
  }

  const r: MonthlyFinanceReport = reportQ.data!;
  const totalByCategory = topCategories.reduce((s, [, v]) => s + v, 0);
  const hasAnything =
    r.totals.income > 0 ||
    r.totals.expense > 0 ||
    r.budgetUsage.length > 0 ||
    r.savingGoals.length > 0 ||
    r.debts.items.length > 0;

  return (
    <Screen scroll>
      <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.xs }]}>
        {t('reports.monthly')}
      </Text>
      <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.lg }]}>
        {t('reports.monthlyDescription', { month })}
      </Text>

      {!hasAnything ? (
        <EmptyState
          title={t('reports.monthlySections.empty.title')}
          description={t('reports.monthlySections.empty.description')}
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          {/* Totals */}
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <MoneyCard
                label={t('reports.income')}
                amount={r.totals.income}
                tone="positive"
              />
            </View>
            <View style={{ flex: 1 }}>
              <MoneyCard
                label={t('reports.expense')}
                amount={r.totals.expense}
                tone="warning"
              />
            </View>
          </View>
          <MoneyCard
            label={t('reports.monthlySections.saving')}
            amount={r.totals.saving}
            tone={r.totals.saving >= 0 ? 'positive' : 'danger'}
            hint={
              r.totals.savingRatePercent !== null
                ? t('reports.monthlySections.savingRate', { pct: r.totals.savingRatePercent })
                : undefined
            }
          />

          {/* Spending by category */}
          {topCategories.length > 0 ? (
            <Card>
              <Text style={[typography.bodyStrong, { color: colors.text, marginBottom: spacing.sm }]}>
                {t('reports.monthlySections.byCategory')}
              </Text>
              {topCategories.map(([cat, amount]) => {
                const pct = totalByCategory > 0
                  ? Math.round((amount / totalByCategory) * 100)
                  : 0;
                return (
                  <View key={cat} style={{ paddingVertical: spacing.xs }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        marginBottom: 4,
                      }}
                    >
                      <Text style={{ color: colors.text }}>{cat}</Text>
                      <Text style={{ color: colors.text, fontWeight: '600' }}>
                        {formatMoneyByLocale(amount)} · {pct}%
                      </Text>
                    </View>
                    <View
                      style={{
                        height: 4,
                        backgroundColor: colors.surfaceMuted,
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          backgroundColor: colors.primary,
                        }}
                      />
                    </View>
                  </View>
                );
              })}
            </Card>
          ) : null}

          {/* Budget usage */}
          {r.budgetUsage.length > 0 ? (
            <Card>
              <Text style={[typography.bodyStrong, { color: colors.text, marginBottom: spacing.sm }]}>
                {t('reports.monthlySections.budgetUsage')}
              </Text>
              {r.budgetUsage.map((b) => {
                const tone =
                  b.usedPercent >= 100 ? 'danger' : b.overThreshold ? 'warning' : 'neutral';
                return (
                  <View key={b.id} style={{ paddingVertical: spacing.xs }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: colors.text }}>{b.category}</Text>
                      <Badge tone={tone}>{`${b.usedPercent}%`}</Badge>
                    </View>
                    <Text style={[typography.small, { color: colors.textMuted }]}>
                      {formatMoneyByLocale(b.used)} / {formatMoneyByLocale(b.amount)}
                    </Text>
                  </View>
                );
              })}
            </Card>
          ) : null}

          {/* Debts */}
          {r.debts.items.length > 0 ? (
            <Card>
              <Text style={[typography.bodyStrong, { color: colors.text, marginBottom: spacing.sm }]}>
                {t('reports.monthlySections.debts')}
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {t('debts.iOwe')}
                  </Text>
                  <Text style={{ color: colors.danger, fontWeight: '700' }}>
                    {formatMoneyByLocale(r.debts.iOwe)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {t('debts.owedToMe')}
                  </Text>
                  <Text style={{ color: colors.success, fontWeight: '700' }}>
                    {formatMoneyByLocale(r.debts.owedToMe)}
                  </Text>
                </View>
              </View>
              {r.debts.items.slice(0, 5).map((d) => (
                <View key={d.id} style={{ paddingVertical: spacing.xs }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: colors.text }}>{d.title}</Text>
                    <Text style={{ color: colors.text, fontWeight: '600' }}>
                      {formatMoneyByLocale(d.remaining)}
                    </Text>
                  </View>
                  {d.dueDate ? (
                    <Text style={[typography.small, { color: colors.textMuted }]}>
                      {t('debts.due')}: {formatDateByLocale(d.dueDate, { weekday: undefined })}
                    </Text>
                  ) : null}
                </View>
              ))}
            </Card>
          ) : null}

          {/* Saving goals */}
          {r.savingGoals.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={[typography.bodyStrong, { color: colors.text }]}>
                {t('reports.monthlySections.savingGoals')}
              </Text>
              {r.savingGoals.slice(0, 5).map((g) => (
                <ProgressCard
                  key={g.id}
                  title={g.title}
                  current={g.current}
                  target={g.target}
                  currentLabel={`${formatMoneyByLocale(g.current)} / ${formatMoneyByLocale(g.target)}`}
                  subtitle={
                    g.targetDate
                      ? `${t('savings.targetDate')}: ${formatDateByLocale(g.targetDate, { weekday: undefined })}`
                      : undefined
                  }
                />
              ))}
            </View>
          ) : null}

          {/* AI advice */}
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
              <Text style={[typography.bodyStrong, { color: colors.text, flex: 1 }]}>
                {t('reports.monthlySections.aiAdvice')}
              </Text>
              {aiResult ? <Badge tone="primary">AI</Badge> : null}
            </View>
            {!aiResult ? (
              <Button
                title={aiMut.isPending ? t('common.loading') : t('reports.generateMonthly')}
                onPress={() => aiMut.mutate()}
                disabled={aiMut.isPending}
              />
            ) : (
              <View style={{ gap: spacing.sm }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {t('reports.allocation')}: {t('reports.need')} {aiResult.salaryAllocationSuggestion.needPercent}% ·{' '}
                  {t('reports.want')} {aiResult.salaryAllocationSuggestion.wantPercent}% ·{' '}
                  {t('reports.save')} {aiResult.salaryAllocationSuggestion.savePercent}%
                </Text>
                <Text style={{ color: colors.text }}>
                  {aiResult.salaryAllocationSuggestion.comment}
                </Text>
                <InsightList title={t('reports.patterns')} items={aiResult.spendingPatterns} />
                <InsightList title={t('reports.savingSuggestions')} items={aiResult.savingSuggestions} />
                <InsightList title={t('reports.debtSuggestions')} items={aiResult.debtSuggestions} />
                <InsightList title={t('reports.advice')} items={aiResult.usefulAdvice} />
                <Button
                  title={aiMut.isPending ? t('common.loading') : t('reports.regenerate')}
                  variant="ghost"
                  size="sm"
                  onPress={() => aiMut.mutate()}
                  disabled={aiMut.isPending}
                />
              </View>
            )}
            <Text style={[typography.small, { color: colors.textMuted, marginTop: spacing.sm }]}>
              {t('reports.disclaimer')}
            </Text>
          </Card>
        </View>
      )}
    </Screen>
  );
}

function InsightList({ title, items }: { title: string; items: string[] }) {
  const { colors, spacing, typography } = useTheme();
  if (!items || items.length === 0) return null;
  return (
    <View>
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
        {title}
      </Text>
      {items.map((s, i) => (
        <Text key={i} style={{ color: colors.text, marginTop: 2 }}>
          • {s}
        </Text>
      ))}
    </View>
  );
}
