/**
 * LifeOS AI — foundation app shell.
 *
 * Round 0 surface: a single screen that proves the entire pipeline is live —
 * bare React Native renders, the JS bundle loads, and the device can reach
 * the API over Tailscale. Real auth + Quick Capture + Home land in round 1+.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { probeHealth, type HealthResult } from './src/api/health';

const palette = {
  canvas: '#0B0B0F',
  surface: '#15151B',
  surfaceAlt: '#1F1F27',
  border: '#252530',
  textPrimary: '#F4EFE7',
  textSecondary: '#9C968B',
  textMuted: '#6B6760',
  accent: '#C97B4A',
  success: '#7FA66B',
  warning: '#D6A24E',
  danger: '#C9624A',
};

function statusColor(status: HealthResult['status']): string {
  switch (status) {
    case 'ok':
      return palette.success;
    case 'reachable_but_degraded':
      return palette.warning;
    default:
      return palette.danger;
  }
}

function statusLabel(status: HealthResult['status']): string {
  switch (status) {
    case 'ok':
      return 'API reachable';
    case 'reachable_but_degraded':
      return 'API up, dependencies degraded';
    default:
      return 'API unreachable';
  }
}

export default function App(): React.JSX.Element {
  const [result, setResult] = useState<HealthResult | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const run = useCallback(async () => {
    setRefreshing(true);
    try {
      setResult(await probeHealth());
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <StatusBar barStyle="light-content" backgroundColor={palette.canvas} />
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={run}
              tintColor={palette.accent}
              colors={[palette.accent]}
            />
          }
        >
          <Text style={styles.kicker}>LifeOS AI · Round 0</Text>
          <Text style={styles.title}>Foundation is live.</Text>
          <Text style={styles.body}>
            Bare React Native, built on huy-server, installed over Tailscale ADB.
            This screen pings the API to confirm the whole pipeline works
            end-to-end. Pull to retry.
          </Text>

          <HealthCard result={result} loading={refreshing && !result} />

          <Pressable
            onPress={run}
            disabled={refreshing}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              refreshing && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.buttonLabel}>
              {refreshing ? 'Probing…' : 'Probe again'}
            </Text>
          </Pressable>

          <Text style={styles.footnote}>
            Onboarding, Quick Capture, and the Home dashboard arrive in round 1.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

interface HealthCardProps {
  result: HealthResult | null;
  loading: boolean;
}

function HealthCard({ result, loading }: HealthCardProps): React.JSX.Element {
  if (loading || !result) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={palette.accent} />
        <Text style={[styles.cardLabel, { marginTop: 8 }]}>Probing API…</Text>
      </View>
    );
  }
  const tone = statusColor(result.status);
  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={[styles.dot, { backgroundColor: tone }]} />
        <Text style={[styles.cardLabel, { color: tone }]}>
          {statusLabel(result.status)}
        </Text>
      </View>
      <Text style={styles.cardMeta}>
        {result.baseUrl} · {result.latencyMs}ms
      </Text>
      {result.data ? (
        <View style={styles.cardDetail}>
          <Detail k="service" v={result.data.service} />
          <Detail k="version" v={result.data.version} />
          <Detail k="db" v={result.data.db} tone={result.data.db === 'ok' ? palette.success : palette.danger} />
          <Detail k="redis" v={result.data.redis} tone={result.data.redis === 'ok' ? palette.success : palette.danger} />
          <Detail k="uptime" v={`${result.data.uptimeSec}s`} />
        </View>
      ) : null}
      {result.error ? <Text style={styles.cardError}>{result.error}</Text> : null}
    </View>
  );
}

function Detail({ k, v, tone }: { k: string; v: string; tone?: string }): React.JSX.Element {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailKey}>{k}</Text>
      <Text style={[styles.detailValue, tone ? { color: tone } : null]}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.canvas },
  scroll: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 48 },

  kicker: {
    color: palette.accent,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 12,
    fontWeight: '600',
  },
  title: {
    color: palette.textPrimary,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '600',
  },
  body: {
    color: palette.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
    marginBottom: 24,
  },

  card: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    gap: 6,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  cardLabel: { fontSize: 16, fontWeight: '600' },
  cardMeta: { color: palette.textMuted, fontSize: 13, marginTop: 2 },
  cardDetail: {
    marginTop: 16,
    borderTopColor: palette.border,
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 6,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailKey: { color: palette.textMuted, fontSize: 13 },
  detailValue: { color: palette.textPrimary, fontSize: 13, fontVariant: ['tabular-nums'] },
  cardError: {
    color: palette.danger,
    fontSize: 13,
    marginTop: 12,
    fontVariant: ['tabular-nums'],
  },

  button: {
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: palette.accent,
    alignItems: 'center',
  },
  buttonPressed: { backgroundColor: '#B86A3C', transform: [{ scale: 0.98 }] },
  buttonDisabled: { opacity: 0.6 },
  buttonLabel: { color: palette.canvas, fontSize: 15, fontWeight: '600' },

  footnote: {
    color: palette.textMuted,
    fontSize: 12,
    marginTop: 32,
    textAlign: 'center',
  },
});
