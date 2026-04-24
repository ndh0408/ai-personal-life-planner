import React from 'react';
import { View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Card, Button, Loading, ErrorView, EmptyState, Badge } from '../../components/ui';
import { expensesApi } from '../../services/api/finance.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { formatDateByLocale, formatMoneyByLocale } from '../../utils/format';

export function ExpenseScreen() {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const translateError = useErrorMessage();
  const q = useQuery({
    queryKey: ['expenses', 'recent'],
    queryFn: () => expensesApi.list({ limit: 50, page: 1 }),
  });

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorView message={translateError(q.error)} onRetry={() => q.refetch()} />;
  const items = q.data?.items ?? [];

  return (
    <Screen scroll>
      <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.lg }]}>
        {t('nav.expense')}
      </Text>
      {items.length === 0 ? (
        <EmptyState title={t('expenses.empty.title')} description={t('expenses.empty.description')} />
      ) : (
        <View style={{ gap: spacing.md }}>
          {items.map((e) => (
            <Card key={e.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.bodyStrong, { color: colors.text }]}>{e.title}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
                    {e.category} · {formatDateByLocale(e.expenseDate, { weekday: undefined })}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[typography.bodyStrong, { color: colors.danger }]}>
                    − {formatMoneyByLocale(e.amount)}
                  </Text>
                  {e.needLevel ? <Badge tone="neutral">{e.needLevel}</Badge> : null}
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
