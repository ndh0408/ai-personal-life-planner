import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetSummaryDto } from '@planner/shared';

/**
 * Mobile-side widget snapshot store.
 *
 * The native iOS / Android widget binaries (when ahopt-prebuild lands —
 * see docs/WIDGETS.md) read this file via App Group / FileProvider; on the
 * RN side we just keep the JSON in AsyncStorage so the in-app preview +
 * the Settings preview screen stay in sync without a round-trip to the API.
 *
 * Privacy posture:
 *   - The snapshot key is namespaced per the currently signed-in user, so
 *     a user-switch never leaks a previous user's data into the next
 *     user's preview.
 *   - On logout we call `clear()` to wipe every key under the namespace.
 *   - When showFinanceAmounts=false the BACKEND already strips the
 *     amounts field, so the snapshot doesn't even contain them.
 */
const NAMESPACE = 'lifeos.widget.snapshot';
const VERSION = 1;

export interface CachedSnapshot {
  /** Schema version for the on-disk file. Bumped on shape changes. */
  version: number;
  /** User id this snapshot belongs to — defends against cross-user leak. */
  userId: string;
  /** Server-side timestamp from `widgetUpdatedAt`. */
  serverUpdatedAt: string;
  /** Local timestamp when this device wrote the file. */
  cachedAt: string;
  data: WidgetSummaryDto;
}

function keyFor(userId: string): string {
  return `${NAMESPACE}.${VERSION}.${userId}`;
}

const INDEX_KEY = `${NAMESPACE}.${VERSION}.index`;

async function getIndex(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function appendIndex(userId: string): Promise<void> {
  const idx = await getIndex();
  if (!idx.includes(userId)) {
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify([...idx, userId]));
  }
}

export const widgetSnapshotStore = {
  async write(userId: string, data: WidgetSummaryDto): Promise<void> {
    const payload: CachedSnapshot = {
      version: VERSION,
      userId,
      serverUpdatedAt: data.widgetUpdatedAt,
      cachedAt: new Date().toISOString(),
      data,
    };
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(payload));
    await appendIndex(userId);
  },

  async read(userId: string): Promise<CachedSnapshot | null> {
    try {
      const raw = await AsyncStorage.getItem(keyFor(userId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CachedSnapshot;
      // Defence-in-depth: refuse to return a snapshot whose embedded
      // userId does not match the requesting userId. Should never happen
      // because the key is namespaced, but cheap to enforce.
      if (parsed.userId !== userId) return null;
      return parsed;
    } catch {
      return null;
    }
  },

  /** Wipe ALL widget snapshots — called on logout. */
  async clear(): Promise<void> {
    const idx = await getIndex();
    await Promise.all([
      ...idx.map((uid) => AsyncStorage.removeItem(keyFor(uid))),
      AsyncStorage.removeItem(INDEX_KEY),
    ]);
  },
};
