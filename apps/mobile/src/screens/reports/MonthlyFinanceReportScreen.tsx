import React from 'react';
import { Alert, Text, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Card, Button, Loading, ErrorView, MoneyCard, ProgressCard } from '../../components/ui';
import { aiApi } from '../../services/api/ai.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { formatMoneyByLocale } from '../../utils/format';

function currentMonthTag(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function MonthlyFinanceReportScreen() {
  const { colors, spacing, typography } = useTheme();
  const { t } = useTranslation();
  const translateError = useErrorMessage();

  const m = useMutation({
    mutationFn: (month: string) => aiApi.analyzeFinance({ month }),
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e)),
  });

  const generate = () => m.mutate(currentMonthTag());

  if (m.isPending) return <Loading />;
  if (m.error) return <ErrorView message={translateError(m.error)} onRetry={generate} />;
  const result = m.data;

  return (
    <Screen scroll>
      <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.xs }]}>
        {t('reports.monthly')}
      </Text>
      <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.lg }]}>
        {t('reports.monthlyDescription', { month: currentMonthTag() })}
      </Text>

      {!result ? (
        <Button title={t('reports.generateMonthly')} onPress={generate} />
      ) : (
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <MoneyCard
                label={t('reports.income')}
                amount={result.analysis.totalIncome}
                tone="positive"
              />
            </View>
            <View style={{ flex: 1 }}>
              <MoneyCard
                label={t('reports.expense')}
                amount={result.analysis.totalExpense}
                tone="warning"
              />
            </View>
          </View>
          <MoneyCard
            label={t('reports.remaining')}
            amount={result.analysis.remainingMoney}
            tone={result.analysis.remainingMoney >= 0 ? 'positive' : 'danger'}
          />

          <Card>
            <Text style={[typography.bodyStrong, { color: colors.text, marginBottom: spacing.sm }]}>
              {t('reports.allocation')}
            </Text>
            <AllocRow
              label={t('reports.need')}
              pct={result.analysis.salaryAllocationSuggestion.needPercent}
              tone="default"
            />
            <AllocRow
              label={t('reports.want')}
              pct={result.analysis.salaryAllocationSuggestion.wantPercent}
              tone="warning"
            />
            <AllocRow
              label={t('reports.save')}
              pct={result.analysis.salaryAllocationSuggestion.savePercent}
              tone="positive"
            />
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
              {result.analysis.salaryAllocationSuggestion.comment}
            </Text>
          </Card>

          <ListCard title={t('reports.patterns')} items={result.analysis.spendingPatterns} />
          <ListCard title={t('reports.savingSuggestions')} items={result.analysis.savingSuggestions} />
          <ListCard title={t('reports.debtSuggestions')} items={result.analysis.debtSuggestions} />
          <ListCard title={t('reports.advice')} items={result.analysis.usefulAdvice} />

          <Button title={t('reports.regenerate')} variant="secondary" onPress={generate} />
        </View>
      )}
    </Screen>
  );
}

function AllocRow({ label, pct, tone }: { label: string; pct: number; tone: 'default' | 'warning' | 'positive' }) {
  const { colors, spacing } = useTheme();
  const color =
    tone === 'warning' ? colors.warning : tone === 'positive' ? colors.success : colors.text;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs }}>
      <Text style={{ color: colors.text }}>{label}</Text>
      <Text style={{ color, fontWeight: '600' }}>{pct}%</Text>
    </View>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  const { colors, spacing, typography } = useTheme();
  if (!items || items.length === 0) return null;
  return (
    <Card>
      <Text style={[typography.bodyStrong, { color: colors.text, marginBottom: spacing.sm }]}>
        {title}
      </Text>
      {items.map((s, i) => (
        <Text key={i} style={{ color: colors.text, marginBottom: 4 }}>
          • {s}
        </Text>
      ))}
    </Card>
  );
}
