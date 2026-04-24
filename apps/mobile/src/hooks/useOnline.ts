import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { env } from '../config/env';

/**
 * Lightweight "are we online to our API?" probe.
 *
 * Avoids pulling in @react-native-community/netinfo just for a banner.
 * Sends a HEAD-style fetch to `/health` every 45 s (and when the app
 * comes back to the foreground), flipping the bool accordingly. Failures
 * — DNS, timeout, non-2xx — count as offline.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;

    async function probe() {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 6_000);
        const base = env.apiBaseUrl.replace(/\/$/, '');
        const res = await fetch(`${base}/health`, { signal: controller.signal });
        clearTimeout(t);
        if (!cancelled) setOnline(res.ok);
      } catch {
        if (!cancelled) setOnline(false);
      }
    }

    probe();
    timer = setInterval(probe, 45_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') probe();
    });

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      sub.remove();
    };
  }, []);

  return online;
}
