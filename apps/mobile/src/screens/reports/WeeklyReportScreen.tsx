import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { Screen, Card, Loading, ErrorView, Badge, Button } from '../../components/ui';
import { aiApi, type WeeklyInsightResponse } from '../../services/api/ai.api';

function startOfWeekIso(): string {
  const d = new Date();
  const day = d.getUTCDay() || 7; // Sunday=0 → 7
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

export function WeeklyReportScreen() {
  const { colors, spacing } = useTheme();
  const [data, setData] = useState<WeeklyInsightResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const weekStart = startOfWeekIso();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await aiApi.weeklyInsight({ weekStart });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen scroll>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: spacing.xs }}>
        Weekly report
      </Text>
      <Text style={{ color: colors.textMuted, marginBottom: spacing.lg }}>
        Week starting {weekStart}
      </Text>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorView message={error} onRetry={load} />
      ) : data ? (
        <>
          <Card style={{ marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.sm }}>
              {data.usedFallback ? <Badge tone="warning">AI fallback</Badge> : <Badge tone="primary">AI</Badge>}
            </View>
            <Text style={{ color: colors.text, fontSize: 14, lineHeight: 22 }}>
              {data.insight.summary}
            </Text>
          </Card>

          <Section title="What went well" items={data.insight.goodPoints} tone="success" />
          <Section title="Where to improve" items={data.insight.improvementPoints} tone="warning" />
          <Section title="For next week" items={data.insight.nextWeekSuggestions} tone="primary" />

          <Button title="Refresh" variant="secondary" onPress={load} style={{ marginTop: spacing.md }} />
        </>
      ) : null}
    </Screen>
  );
}

function Section({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: 'success' | 'warning' | 'primary';
}) {
  const { colors, spacing } = useTheme();
  if (!items.length) return null;
  return (
    <Card style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
        <Badge tone={tone}>{title}</Badge>
      </View>
      {items.map((it, i) => (
        <Text key={i} style={{ color: colors.text, fontSize: 14, marginBottom: 4 }}>
          • {it}
        </Text>
      ))}
    </Card>
  );
}
