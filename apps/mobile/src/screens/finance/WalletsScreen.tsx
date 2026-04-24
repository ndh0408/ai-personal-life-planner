import React from 'react';
import { View, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Card, Loading, ErrorView, EmptyState, Badge } from '../../components/ui';
import { walletsApi } from '../../services/api/finance.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { formatMoneyByLocale } from '../../utils/format';

export function WalletsScreen() {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const translateError = useErrorMessage();
  const q = useQuery({ queryKey: ['wallets'], queryFn: () => walletsApi.list() });

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorView message={translateError(q.error)} onRetry={() => q.refetch()} />;
  if ((q.data ?? []).length === 0) {
    return <EmptyState title={t('wallets.empty.title')} description={t('wallets.empty.description')} />;
  }

  return (
    <Screen scroll>
      <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.lg }]}>
        {t('nav.wallets')}
      </Text>
      <View style={{ gap: spacing.md }}>
        {(q.data ?? []).map((w) => (
          <Card key={w.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
              <Text style={[typography.bodyStrong, { color: colors.text }]}>{w.name}</Text>
              <Badge tone="neutral">{w.type}</Badge>
              {!w.isActive ? <Badge tone="neutral">{t('common.inactive')}</Badge> : null}
            </View>
            <Text style={[typography.h2, { color: colors.text }]}>
              {formatMoneyByLocale(w.balance, w.currency)}
            </Text>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
