import { useEffect, useState } from 'react';
import { networkStatus } from '../services/offline/network-status';

/**
 * Thin hook over NetworkStatusService. Retains the legacy name so existing
 * callers keep working; the backing service is a singleton so mutation
 * helpers can read the same truth synchronously via `networkStatus.get()`.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState<boolean>(networkStatus.get());
  useEffect(() => networkStatus.subscribe(setOnline), []);
  return online;
}
