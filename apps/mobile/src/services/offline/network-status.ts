import { AppState } from 'react-native';
import { env } from '../../config/env';

/**
 * NetworkStatusService — single source of truth for "are we online to our API?".
 *
 * Implemented as a /health probe rather than the OS link status because a WiFi
 * link can be up while our server is unreachable (DNS, VPN, firewalled hotel WiFi).
 * Emits to subscribers on every state change; screens call `subscribe()` via
 * the `useOnline` hook, and mutation helpers read `get()` synchronously.
 */

type Listener = (online: boolean) => void;

const PROBE_INTERVAL_MS = 45_000;
const PROBE_TIMEOUT_MS = 6_000;

class NetworkStatusService {
  private online = true;
  private probedOnce = false;
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private appStateSub: { remove: () => void } | undefined;
  private started = false;

  /** Synchronous last-known status. Defaults to `true` before the first probe. */
  get(): boolean {
    return this.online;
  }

  hasProbed(): boolean {
    return this.probedOnce;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.probe();
    this.timer = setInterval(() => this.probe(), PROBE_INTERVAL_MS);
    this.appStateSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') this.probe();
    });
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.appStateSub?.remove();
    this.timer = undefined;
    this.appStateSub = undefined;
    this.started = false;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.online);
    return () => {
      this.listeners.delete(fn);
    };
  }

  async probe(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
      const base = env.apiBaseUrl.replace(/\/$/, '');
      const res = await fetch(`${base}/health`, { signal: controller.signal });
      clearTimeout(t);
      this.set(res.ok);
    } catch {
      this.set(false);
    }
    this.probedOnce = true;
    return this.online;
  }

  /** Explicit override — used by mutation helpers after a raw network error. */
  markOffline(): void {
    this.set(false);
  }

  private set(next: boolean): void {
    if (this.online === next) return;
    this.online = next;
    for (const l of this.listeners) l(next);
  }
}

export const networkStatus = new NetworkStatusService();
