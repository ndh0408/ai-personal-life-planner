/**
 * Wipe everything stored on the device:
 *  - AsyncStorage (TanStack Query persisted cache, locale prefs, …)
 *  - Keychain tokens
 *  - In-memory query cache
 *  - Auth store → routes back to login
 *
 * Server data is untouched. Useful for "log me out everywhere on this
 * device", debugging stale cache, or selling the phone.
 */
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api/client';
import { cache } from '../services/storage/cache';
import { useAuthStore } from '../store/auth.store';

export function useWipeCache() {
  const qc = useQueryClient();
  const signOut = useAuthStore((s) => s.signOut);

  return async () => {
    qc.clear();
    await cache.wipe();
    apiClient.setTokens(null);
    await signOut(); // routes to unauthenticated, clears auth store
  };
}
