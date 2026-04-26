/**
 * Non-sensitive cache layer over AsyncStorage.
 * Synchronous-feel API via tiny in-memory mirror so screens can read on first
 * render and reconcile from disk when the promise resolves. Swap to MMKV
 * later if perf becomes an issue (zero call sites need to change).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const memMirror = new Map<string, string>();

export const cache = {
  async getString(key: string): Promise<string | null> {
    const inMem = memMirror.get(key);
    if (inMem !== undefined) return inMem;
    const v = await AsyncStorage.getItem(key);
    if (v !== null) memMirror.set(key, v);
    return v;
  },

  /** Sync read of in-memory mirror only — for first-render hints. */
  peekString(key: string): string | null {
    return memMirror.get(key) ?? null;
  },

  async set(key: string, value: string): Promise<void> {
    memMirror.set(key, value);
    await AsyncStorage.setItem(key, value);
  },

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.getString(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  async setJson<T>(key: string, value: T): Promise<void> {
    await this.set(key, JSON.stringify(value));
  },

  async remove(key: string): Promise<void> {
    memMirror.delete(key);
    await AsyncStorage.removeItem(key);
  },

  async wipe(): Promise<void> {
    memMirror.clear();
    await AsyncStorage.clear();
  },
};

export const CACHE_KEYS = {
  locale: 'lifeos.cache.locale',
  lastUserEmail: 'lifeos.cache.lastUserEmail',
  homeStats: 'lifeos.cache.homeStats',
} as const;
