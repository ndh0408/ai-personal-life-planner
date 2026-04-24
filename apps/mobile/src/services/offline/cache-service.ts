import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * CacheService — persists a curated set of React Query results to AsyncStorage
 * so the app can render cached data while offline.
 *
 * Design:
 *   - Whitelist by key prefix (WHITELIST below). Anything not whitelisted
 *     stays in-memory only, which matters for large paginated queries whose
 *     content is cheap to refetch and expensive to serialize.
 *   - Write-through on every successful query via `subscribe` on the
 *     QueryCache. Debounce-less because writes are small + AsyncStorage is
 *     already buffered on native.
 *   - Read-through on `hydrate()` at app boot: re-seed `queryClient.setQueryData`
 *     so screens can render the last snapshot instantly.
 *   - Language setting is persisted separately by the i18n layer; this
 *     service doesn't duplicate that.
 */

const STORAGE_PREFIX = 'offline:cache:';

/**
 * Which queries we persist. Compared against the first element of the
 * query key array; that's enough granularity for every screen in the app.
 */
const WHITELIST: ReadonlySet<string> = new Set([
  'profile',
  'dashboard',
  'schedules',
  'today',
  'tasks',
  'habits',
  'meals',
  'health',
  'sleep-mood',
  'wallets',
  'incomes',
  'expenses',
  'budgets',
  'debts',
  'saving-goals',
  'goals',
  'assistant',
  'reports',
]);

function isWhitelisted(key: QueryKey): boolean {
  if (!Array.isArray(key) || key.length === 0) return false;
  const head = key[0];
  return typeof head === 'string' && WHITELIST.has(head);
}

function storageKeyFor(key: QueryKey): string {
  return STORAGE_PREFIX + JSON.stringify(key);
}

type Persisted<T = unknown> = {
  savedAt: number;
  data: T;
};

class CacheService {
  private unsubscribe: (() => void) | null = null;
  private wired = false;

  /** Seed the in-memory query cache from AsyncStorage. Call once at boot. */
  async hydrate(qc: QueryClient): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const mine = allKeys.filter((k) => k.startsWith(STORAGE_PREFIX));
      if (mine.length === 0) return;
      const entries = await AsyncStorage.multiGet(mine);
      for (const [storageKey, raw] of entries) {
        if (!raw) continue;
        try {
          const queryKeyJson = storageKey.slice(STORAGE_PREFIX.length);
          const queryKey = JSON.parse(queryKeyJson) as QueryKey;
          const parsed = JSON.parse(raw) as Persisted;
          qc.setQueryData(queryKey, parsed.data);
        } catch {
          // Corrupt entry — drop silently so the next successful fetch overwrites.
        }
      }
    } catch {
      // AsyncStorage unavailable (web edge case / first boot) — caller falls
      // back to network automatically via React Query.
    }
  }

  /** Start write-through. Idempotent. */
  wire(qc: QueryClient): void {
    if (this.wired) return;
    this.wired = true;
    this.unsubscribe = qc.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated') return;
      const query = event.query;
      if (query.state.status !== 'success') return;
      if (!isWhitelisted(query.queryKey)) return;
      void this.persist(query.queryKey, query.state.data);
    });
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.wired = false;
  }

  /** Wipe everything we persist — used on logout. */
  async purge(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const mine = allKeys.filter((k) => k.startsWith(STORAGE_PREFIX));
      if (mine.length > 0) await AsyncStorage.multiRemove(mine);
    } catch {
      // Best-effort — nothing to do on failure.
    }
  }

  private async persist(key: QueryKey, data: unknown): Promise<void> {
    try {
      const payload: Persisted = { savedAt: Date.now(), data };
      await AsyncStorage.setItem(storageKeyFor(key), JSON.stringify(payload));
    } catch {
      // Skip entries that don't stringify (Dates, BigInt) — React Query
      // still holds them in memory, just not cross-launch.
    }
  }
}

export const cacheService = new CacheService();
