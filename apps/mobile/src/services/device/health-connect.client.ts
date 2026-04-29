/**
 * Health Connect adapter (Android-first, round 36).
 *
 * Wraps `react-native-health-connect` so the rest of the app talks to a
 * single, platform-agnostic interface. iOS will plug in HealthKit later
 * via the same shape; today the iOS branch returns an empty result so
 * the sync job runs without crashing.
 *
 * All reads are scoped to time windows the API tells us about (the
 * sync cursor) — we never bulk-pull years of history.
 */
import { Platform } from 'react-native';
import {
  initialize,
  requestPermission,
  readRecords,
  type Permission,
} from 'react-native-health-connect';
import type {
  DeviceDataSyncRequest,
  HeartRateSampleDto,
  SleepSample,
  StepBucket,
} from '@lifeos/shared';

export interface HealthConnectStatus {
  available: boolean;
  granted: boolean;
  reason?: 'not-android' | 'not-installed' | 'permission-denied' | 'unknown';
}

const PERMISSIONS: Permission[] = [
  { accessType: 'read', recordType: 'SleepSession' },
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'read', recordType: 'Steps' },
];

let initPromise: Promise<boolean> | null = null;
async function ensureInitialized(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (!initPromise) {
    initPromise = initialize().catch(() => false);
  }
  return initPromise;
}

export const healthConnect = {
  /** Check + request permissions. Returns the resulting status. */
  async ensureReady(): Promise<HealthConnectStatus> {
    if (Platform.OS !== 'android') {
      return { available: false, granted: false, reason: 'not-android' };
    }
    const ok = await ensureInitialized();
    if (!ok) return { available: false, granted: false, reason: 'not-installed' };
    try {
      const granted = await requestPermission(PERMISSIONS);
      const allGranted = granted.length >= PERMISSIONS.length;
      return {
        available: true,
        granted: allGranted,
        reason: allGranted ? undefined : 'permission-denied',
      };
    } catch {
      return { available: true, granted: false, reason: 'unknown' };
    }
  },

  /**
   * Read sleep / heart-rate / step samples since `since`. Caller maps
   * the result into a DeviceDataSyncRequest.
   */
  async pullSince(since: Date): Promise<{
    sleep: SleepSample[];
    heartRate: HeartRateSampleDto[];
    steps: StepBucket[];
  }> {
    if (Platform.OS !== 'android') return { sleep: [], heartRate: [], steps: [] };
    const ok = await ensureInitialized();
    if (!ok) return { sleep: [], heartRate: [], steps: [] };

    const now = new Date();
    const range = {
      operator: 'between' as const,
      startTime: since.toISOString(),
      endTime: now.toISOString(),
    };

    const [sleepRows, hrRows, stepRows] = await Promise.all([
      readRecords('SleepSession', { timeRangeFilter: range }).catch(() => ({ records: [] })),
      readRecords('HeartRate', { timeRangeFilter: range }).catch(() => ({ records: [] })),
      readRecords('Steps', { timeRangeFilter: range }).catch(() => ({ records: [] })),
    ]);

    // The shape from react-native-health-connect is loosely-typed at
    // runtime; cast through `any` once at the boundary.
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const sleep: SleepSample[] = (sleepRows.records as any[]).map((r) => ({
      recordId: String(r.metadata?.id ?? r.metadata?.clientRecordId ?? `${r.startTime}`),
      sleepAt: String(r.startTime),
      wakeAt: String(r.endTime),
    }));

    // Coalesce HR samples into 5-min buckets to keep the row count small.
    const hrBuckets = new Map<string, { sum: number; count: number; max: number }>();
    for (const r of hrRows.records as any[]) {
      for (const sample of r.samples ?? []) {
        const t = new Date(sample.time);
        t.setSeconds(0, 0);
        t.setMinutes(Math.floor(t.getMinutes() / 5) * 5);
        const key = t.toISOString();
        const bpm = Number(sample.beatsPerMinute) || 0;
        if (!bpm) continue;
        const entry = hrBuckets.get(key) ?? { sum: 0, count: 0, max: 0 };
        entry.sum += bpm;
        entry.count += 1;
        entry.max = Math.max(entry.max, bpm);
        hrBuckets.set(key, entry);
      }
    }
    const heartRate: HeartRateSampleDto[] = [...hrBuckets.entries()].map(([iso, agg]) => ({
      bucketStart: iso,
      avgBpm: Math.round(agg.sum / Math.max(1, agg.count)),
      maxBpm: agg.max,
    }));

    // Steps — already arrives bucketed; aggregate to 30-min for parity
    // with our ActivitySample row format.
    const stepBuckets = new Map<string, number>();
    for (const r of stepRows.records as any[]) {
      const t = new Date(r.startTime);
      t.setSeconds(0, 0);
      t.setMinutes(Math.floor(t.getMinutes() / 30) * 30);
      const key = t.toISOString();
      stepBuckets.set(key, (stepBuckets.get(key) ?? 0) + Number(r.count ?? 0));
    }
    const steps: StepBucket[] = [...stepBuckets.entries()].map(([iso, count]) => ({
      bucketStart: iso,
      steps: count,
    }));
    /* eslint-enable @typescript-eslint/no-explicit-any */

    return { sleep, heartRate, steps };
  },
};

/** Build the API sync request given the freshly-pulled samples. */
export function toSyncRequest(
  pulled: Awaited<ReturnType<typeof healthConnect.pullSince>>,
  deviceMeta?: Record<string, string>,
): DeviceDataSyncRequest {
  return {
    source: Platform.OS === 'android' ? 'health-connect' : 'healthkit',
    deviceMeta,
    sleep: pulled.sleep,
    heartRate: pulled.heartRate,
    steps: pulled.steps,
  };
}
