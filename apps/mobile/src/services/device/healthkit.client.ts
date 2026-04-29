/**
 * HealthKit adapter (iOS, round 36).
 *
 * Mirrors the surface of health-connect.client.ts so sync-orchestrator
 * can pick the right backend by Platform.OS without branching its own
 * logic. Uses `react-native-health`, which talks to HKHealthStore via
 * a thin native module.
 *
 * iOS-specific notes:
 *   - HealthKit returns one HKCategoryValueSleepAnalysis sample per
 *     stage. We collapse contiguous "asleep" samples into one
 *     SleepSample with sleepAt = first.startDate, wakeAt = last.endDate.
 *   - Heart-rate and step counts come back as already-bucketed series
 *     when we ask for daily/hourly samples; we re-bucket to 5/30 min
 *     to match the API's ActivitySample / HeartRateSample shape.
 *   - Permissions ARE NOT auto-prompted at app launch — they fire only
 *     when ensureReady() is called the first time the user opens
 *     Settings → Health Sync (round 36 UI lands in R37).
 */
import { Platform } from 'react-native';
import AppleHealthKit from 'react-native-health';
import type {
  HealthInputOptions,
  HealthKitPermissions,
  HealthValue,
} from 'react-native-health';
import type {
  DeviceDataSyncRequest,
  HeartRateSampleDto,
  SleepSample,
  StepBucket,
} from '@lifeos/shared';

export interface HealthKitStatus {
  available: boolean;
  granted: boolean;
  reason?: 'not-ios' | 'unavailable' | 'permission-denied' | 'unknown';
}

const PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.SleepAnalysis,
      AppleHealthKit.Constants.Permissions.HeartRate,
      AppleHealthKit.Constants.Permissions.StepCount,
    ],
    // We only read; never write back to HealthKit.
    write: [],
  },
};

let initPromise: Promise<boolean> | null = null;
function ensureInitialized(): Promise<boolean> {
  if (Platform.OS !== 'ios') return Promise.resolve(false);
  if (!initPromise) {
    initPromise = new Promise<boolean>((resolve) => {
      AppleHealthKit.initHealthKit(PERMISSIONS, (err) => {
        resolve(!err);
      });
    });
  }
  return initPromise;
}

interface RawSleepSample {
  startDate: string;
  endDate: string;
  // 'INBED' | 'ASLEEP' | 'AWAKE' | (newer iOS) 'CORE' | 'DEEP' | 'REM'
  value: string;
  sourceId?: string;
}

const ASLEEP_VALUES = new Set(['ASLEEP', 'CORE', 'DEEP', 'REM']);

function collapseSleep(rows: RawSleepSample[]): SleepSample[] {
  // HealthKit gives us many overlapping/contiguous stage rows. We want
  // one SleepSample per "session". Sort by start, then merge any pair
  // separated by < 30 min.
  const sorted = [...rows]
    .filter((r) => ASLEEP_VALUES.has(r.value))
    .sort((a, b) => Date.parse(a.startDate) - Date.parse(b.startDate));
  if (sorted.length === 0) return [];

  const out: { start: Date; end: Date; ids: string[] }[] = [];
  for (const r of sorted) {
    const start = new Date(r.startDate);
    const end = new Date(r.endDate);
    const last = out[out.length - 1];
    if (last && start.getTime() - last.end.getTime() < 30 * 60_000) {
      if (end > last.end) last.end = end;
      last.ids.push(r.startDate);
    } else {
      out.push({ start, end, ids: [r.startDate] });
    }
  }
  return out
    .filter((s) => s.end.getTime() - s.start.getTime() >= 60 * 60_000) // ≥1h
    .map((s) => ({
      // Stable enough recordId — first stage's startDate is unique per session
      recordId: `hk_${s.ids[0]}`,
      sleepAt: s.start.toISOString(),
      wakeAt: s.end.toISOString(),
    }));
}

export const healthKit = {
  async ensureReady(): Promise<HealthKitStatus> {
    if (Platform.OS !== 'ios') {
      return { available: false, granted: false, reason: 'not-ios' };
    }
    const ok = await ensureInitialized();
    return ok
      ? { available: true, granted: true }
      : { available: true, granted: false, reason: 'permission-denied' };
  },

  async pullSince(since: Date): Promise<{
    sleep: SleepSample[];
    heartRate: HeartRateSampleDto[];
    steps: StepBucket[];
  }> {
    if (Platform.OS !== 'ios') return { sleep: [], heartRate: [], steps: [] };
    const ok = await ensureInitialized();
    if (!ok) return { sleep: [], heartRate: [], steps: [] };

    const startDate = since.toISOString();
    const endDate = new Date().toISOString();
    const opts: HealthInputOptions = { startDate, endDate, limit: 2000 };

    const sleepRaw = await new Promise<RawSleepSample[]>((resolve) => {
      AppleHealthKit.getSleepSamples(opts, (err, results) => {
        resolve(err ? [] : ((results ?? []) as unknown as RawSleepSample[]));
      });
    });

    const hrRaw = await new Promise<HealthValue[]>((resolve) => {
      AppleHealthKit.getHeartRateSamples(opts, (err, results) => {
        resolve(err ? [] : results ?? []);
      });
    });

    const stepRaw = await new Promise<HealthValue[]>((resolve) => {
      AppleHealthKit.getDailyStepCountSamples(opts, (err, results) => {
        resolve(err ? [] : ((results ?? []) as unknown as HealthValue[]));
      });
    });

    // HR → 5-min buckets (avg + max).
    const hrBuckets = new Map<string, { sum: number; count: number; max: number }>();
    for (const sample of hrRaw) {
      const bpm = Number((sample as unknown as { value: number }).value) || 0;
      if (!bpm) continue;
      const t = new Date((sample as unknown as { startDate: string }).startDate);
      t.setSeconds(0, 0);
      t.setMinutes(Math.floor(t.getMinutes() / 5) * 5);
      const key = t.toISOString();
      const entry = hrBuckets.get(key) ?? { sum: 0, count: 0, max: 0 };
      entry.sum += bpm;
      entry.count++;
      entry.max = Math.max(entry.max, bpm);
      hrBuckets.set(key, entry);
    }
    const heartRate: HeartRateSampleDto[] = [...hrBuckets.entries()].map(([iso, agg]) => ({
      bucketStart: iso,
      avgBpm: Math.round(agg.sum / Math.max(1, agg.count)),
      maxBpm: agg.max,
    }));

    // Steps → 30-min buckets.
    const stepBuckets = new Map<string, number>();
    for (const sample of stepRaw) {
      const v = Number((sample as unknown as { value: number }).value) || 0;
      if (!v) continue;
      const t = new Date((sample as unknown as { startDate: string }).startDate);
      t.setSeconds(0, 0);
      t.setMinutes(Math.floor(t.getMinutes() / 30) * 30);
      const key = t.toISOString();
      stepBuckets.set(key, (stepBuckets.get(key) ?? 0) + v);
    }
    const steps: StepBucket[] = [...stepBuckets.entries()].map(([iso, count]) => ({
      bucketStart: iso,
      steps: count,
    }));

    return { sleep: collapseSleep(sleepRaw), heartRate, steps };
  },
};

export function toHealthKitSyncRequest(
  pulled: Awaited<ReturnType<typeof healthKit.pullSince>>,
  deviceMeta?: Record<string, string>,
): DeviceDataSyncRequest {
  return {
    source: 'healthkit',
    deviceMeta,
    sleep: pulled.sleep,
    heartRate: pulled.heartRate,
    steps: pulled.steps,
  };
}
