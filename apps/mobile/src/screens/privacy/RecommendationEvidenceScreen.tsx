import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Card, Loading, ErrorView, Badge } from '../../components/ui';
import { privacyApi } from '../../services/api/privacy.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import type { RootScreenProps } from '../../navigation/types';
import type { RecommendationEvidenceDto } from '@planner/shared';

/**
 * Modal-style screen reachable from a Recommendation card's
 * "Why am I seeing this?" button. Lists every RecommendationEvidence row
 * stored when the recommendation was generated. Empty state shipped for
 * legacy recommendations that pre-date the evidence table.
 */
export function RecommendationEvidenceScreen({
  route,
}: RootScreenProps<'RecommendationEvidence'>) {
  const { recommendationId } = route.params;
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const messageFor = useErrorMessage();

  const q = useQuery({
    queryKey: ['recommendation-evidence', recommendationId],
    queryFn: () => privacyApi.recommendationEvidence(recommendationId),
  });

  if (q.isLoading) return <Loading />;
  if (q.isError) {
    return <ErrorView message={messageFor(q.error)} onRetry={() => q.refetch()} />;
  }
  const items: RecommendationEvidenceDto[] = q.data ?? [];

  return (
    <Screen scroll>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>
          {t('settings.privacy.evidence.title')}
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md }}>
          {t('settings.privacy.evidence.subtitle')}
        </Text>

        {items.length === 0 ? (
          <Card>
            <Text style={{ color: colors.textMuted }}>
              {t('settings.privacy.evidence.empty')}
            </Text>
          </Card>
        ) : (
          items.map((e) => (
            <Card key={e.id} style={{ marginBottom: spacing.md }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing.xs,
                }}
              >
                <Badge tone="info">
                  {t(`settings.privacy.evidence.dataType.${e.dataType}`)}
                </Badge>
                {e.weight !== null ? (
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    {Math.round(e.weight * 100)}%
                  </Text>
                ) : null}
              </View>
              <Text style={{ color: colors.text, lineHeight: 20 }}>{e.summary}</Text>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
