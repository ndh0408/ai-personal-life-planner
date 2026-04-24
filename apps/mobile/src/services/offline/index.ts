import type { QueryClient } from '@tanstack/react-query';
import { networkStatus } from './network-status';
import { cacheService } from './cache-service';
import { syncQueue } from './sync-queue';

export { networkStatus } from './network-status';
export { cacheService } from './cache-service';
export { syncQueue, mintTempId, type PendingAction } from './sync-queue';

/**
 * One-time boot wiring for the offline stack. Called from `App.tsx` after
 * i18n init so the cache hydrates before the first screen renders.
 *
 * Order matters:
 *   1. Hydrate cache → `queryClient.setQueryData` for whitelisted keys.
 *   2. Wire write-through so subsequent fetches persist.
 *   3. Start network probes.
 *   4. Subscribe to reconnect → flush queue + invalidate.
 */
export async function bootOfflineServices(qc: QueryClient): Promise<void> {
  await cacheService.hydrate(qc);
  cacheService.wire(qc);
  networkStatus.start();
  networkStatus.subscribe((online) => {
    if (!online) return;
    void syncQueue.flush(qc).then((result) => {
      if (result.succeeded > 0 || result.failedPermanent > 0) {
        // Sync finished — refresh everything so views reflect the server.
        qc.invalidateQueries();
      }
    });
  });
}

/** Called on logout. Wipe persisted cache + queue so the next user starts clean. */
export async function resetOfflineState(): Promise<void> {
  await Promise.all([cacheService.purge(), syncQueue.purge()]);
}
