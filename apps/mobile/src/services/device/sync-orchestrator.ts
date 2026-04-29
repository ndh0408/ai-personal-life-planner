/**
 * Coordinates the read-from-platform-health-store → push-to-API flow
 * (round 36; iOS branch added on the same round).
 *
 * Lifecycle:
 *   1. Pick the platform adapter — Health Connect on Android,
 *      HealthKit on iOS — and ensure permissions are granted.
 *   2. Read samples since `since` (we trust the API's `lastSyncedAt`
 *      cursor it returned in the previous response). On first run we
 *      pull only the last 24 h to avoid a huge backfill.
 *   3. POST to /device-data/sync. Save the new cursor in AsyncStorage.
 *
 * Failures are silent + logged in the debug store — sensor sync isn't
 * worth interrupting the user for.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { deviceDataService } from '../api/deviceData.service';
import { healthConnect, toSyncRequest } from './health-connect.client';
import { healthKit, toHealthKitSyncRequest } from './healthkit.client';
import type { DeviceDataSyncRequest } from '@lifeos/shared';

const CURSOR_KEY = 'lifeos.deviceSync.cursor.v1';
const FIRST_RUN_LOOKBACK_HOURS = 24;
const DEBOUNCE_MS = 60_000; // don't double-sync within a minute

let lastSyncAt = 0;
let inflight: Promise<void> | null = null;

async function loadCursor(): Promise<Date> {
  try {
    const raw = await AsyncStorage.getItem(CURSOR_KEY);
    if (raw) return new Date(raw);
  } catch {
    /* noop */
  }
  return new Date(Date.now() - FIRST_RUN_LOOKBACK_HOURS * 60 * 60_000);
}

async function saveCursor(at: Date): Promise<void> {
  try {
    await AsyncStorage.setItem(CURSOR_KEY, at.toISOString());
  } catch {
    /* noop */
  }
}

export const syncOrchestrator = {
  /**
   * Idempotent — concurrent calls collapse onto one in-flight promise.
   * `force=true` skips the debounce (used by DevPanel's "Sync now").
   */
  async run(opts: { force?: boolean } = {}): Promise<void> {
    // Cast once — RN types Platform.OS as a literal that narrows
    // depending on the build target; widening to string lets us check
    // both branches without TS complaining about "no overlap".
    const platform = Platform.OS as string;
    if (platform !== 'android' && platform !== 'ios') return;
    if (inflight) return inflight;
    if (!opts.force && Date.now() - lastSyncAt < DEBOUNCE_MS) return;

    inflight = (async () => {
      try {
        const isAndroid = platform === 'android';
        const isIos = platform === 'ios';

        const status = isAndroid
          ? await healthConnect.ensureReady()
          : await healthKit.ensureReady();
        if (!status.granted) return;

        const since = await loadCursor();
        const pulled = isAndroid
          ? await healthConnect.pullSince(since)
          : await healthKit.pullSince(since);
        if (
          pulled.sleep.length === 0 &&
          pulled.heartRate.length === 0 &&
          pulled.steps.length === 0
        ) {
          return;
        }
        const meta = { platform: Platform.OS, version: String(Platform.Version) };
        const req: DeviceDataSyncRequest = isAndroid
          ? toSyncRequest(pulled, meta)
          : toHealthKitSyncRequest(pulled, meta);
        const res = await deviceDataService.sync(req);
        await saveCursor(new Date(res.lastSyncedAt));
        lastSyncAt = Date.now();
      } catch {
        /* swallow — sensor sync is best-effort */
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },
};
