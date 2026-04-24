import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Card, Loading, ErrorView, InsightCard, MoneyCard, RecommendationCard } from '../../components/ui';
import { assistantApi } from '../../services/api/assistant.api';
import { walletsApi } from '../../services/api/finance.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';

export function DashboardScreen() {
  const { colors, spacing, typography } = useTheme();
  const { t } = useTranslation();
  const translateError = useErrorMessage();

  const snapshot = useQuery({
    queryKey: ['assistant', 'today'],
    queryFn: () => assistantApi.today(),
  });
  const wallets = useQuery({ queryKey: ['wallets'], queryFn: () => walletsApi.list() });

  if (snapshot.isLoading || wallets.isLoading) return <Loading />;
  if (snapshot.error) {
    return (
      <ErrorView
        message={translateError(snapshot.error)}
        onRetry={() => snapshot.refetch()}
      />
    );
  }

  const s = snapshot.data!;
  const totalCash = (wallets.data ?? []).reduce((sum, w) => sum + Number(w.balance), 0);
  const currency = wallets.data?.[0]?.currency ?? 'VND';

  const topRecs = s.recommendations.slice(0, 3);

  return (
    <Screen scroll>
      <Text style={[typography.display, { color: colors.text, marginBottom: spacing.xs }]}>
        {t('dashboard.title')}
      </Text>
      <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.lg }]}>
        {t('dashboard.subtitle')}
      </Text>

      {/* Top money + scores row */}
      <View style={{ gap: spacing.md }}>
        <MoneyCard
          label={t('dashboard.cashOnHand')}
          amount={totalCash}
          currency={currency}
          hint={t('dashboard.walletsCount', { count: wallets.data?.length ?? 0 })}
        />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <InsightCard
              title={t('scores.schedule')}
              value={s.scores.scheduleCompletionRate ?? null}
              subtitle={s.scores.scheduleCompletionRate !== null ? '%' : undefined}
            />
          </View>
          <View style={{ flex: 1 }}>
            <InsightCard
              title={t('scores.habits')}
              value={s.scores.habitConsistencyRate ?? null}
              subtitle={s.scores.habitConsistencyRate !== null ? '%' : undefined}
            />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <InsightCard
              title={t('scores.sleep')}
              value={s.scores.sleepConsistencyScore ?? null}
              subtitle={s.scores.sleepConsistencyScore !== null ? '%' : undefined}
            />
          </View>
          <View style={{ flex: 1 }}>
            <InsightCard
              title={t('scores.energy')}
              value="—"
              trend={s.scores.energyTrend}
            />
          </View>
        </View>
      </View>

      {/* Recommendations */}
      <View style={{ marginTop: spacing.xl }}>
        <Text style={[typography.h2, { color: colors.text, marginBottom: spacing.md }]}>
          {t('dashboard.whatMatters')}
        </Text>
        {topRecs.length === 0 ? (
          <Card>
            <Text style={{ color: colors.textMuted }}>{t('dashboard.nothingUrgent')}</Text>
          </Card>
        ) : (
          <View style={{ gap: spacing.md }}>
            {topRecs.map((r) => (
              <RecommendationCard
                key={r.id}
                title={r.title}
                content={r.content}
                priority={r.priority}
                type={r.type}
              />
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}
