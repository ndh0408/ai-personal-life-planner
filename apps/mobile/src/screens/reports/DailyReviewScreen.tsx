import React from 'react';
import { Alert, Text, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Card, Button, Loading, ErrorView } from '../../components/ui';
import { assistantApi, type DailyReviewOutput } from '../../services/api/assistant.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { todayIso } from '../../utils/format';

export function DailyReviewScreen() {
  const { colors, spacing, typography } = useTheme();
  const { t } = useTranslation();
  const translateError = useErrorMessage();

  const m = useMutation({
    mutationFn: (date: string) => assistantApi.generateDailyReview(date),
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e)),
  });

  const generate = () => m.mutate(todayIso());

  if (m.isPending) return <Loading />;
  if (m.error) return <ErrorView message={translateError(m.error)} onRetry={generate} />;
  const review = m.data?.review;

  return (
    <Screen scroll>
      <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.xs }]}>
        {t('reports.daily')}
      </Text>
      <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.lg }]}>
        {t('reports.dailyDescription')}
      </Text>

      {!review ? (
        <Button title={t('reports.generateDaily')} onPress={generate} />
      ) : (
        <View style={{ gap: spacing.md }}>
          <Card>
            <Text style={[typography.bodyStrong, { color: colors.text, marginBottom: spacing.sm }]}>
              {t('reports.summary')}
            </Text>
            <Text style={{ color: colors.text }}>{review.todaySummary}</Text>
          </Card>
          <ReviewBlock title={t('reports.wins')} items={review.wins} />
          <ReviewBlock title={t('reports.issues')} items={review.issues} />
          <ReviewBlock title={t('reports.tomorrow')} items={review.suggestionsForTomorrow} />
          <AdviceCard title={t('reports.healthAdvice')} body={review.healthAdvice} />
          <AdviceCard title={t('reports.financeAdvice')} body={review.financeAdvice} />
          <AdviceCard title={t('reports.productivityAdvice')} body={review.productivityAdvice} />
          <Button title={t('reports.regenerate')} variant="secondary" onPress={generate} />
        </View>
      )}
    </Screen>
  );
}

function ReviewBlock({ title, items }: { title: string; items: string[] }) {
  const { colors, spacing, typography } = useTheme();
  if (items.length === 0) return null;
  return (
    <Card>
      <Text style={[typography.bodyStrong, { color: colors.text, marginBottom: spacing.sm }]}>
        {title}
      </Text>
      {items.map((i, idx) => (
        <Text key={idx} style={{ color: colors.text, marginBottom: 4 }}>
          • {i}
        </Text>
      ))}
    </Card>
  );
}

function AdviceCard({ title, body }: { title: string; body: string }) {
  const { colors, spacing, typography } = useTheme();
  if (!body) return null;
  return (
    <Card>
      <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
        {title}
      </Text>
      <Text style={{ color: colors.text }}>{body}</Text>
    </Card>
  );
}
