import { API_BASE_URL } from '../config/api';

export interface HealthSnapshot {
  service: string;
  version: string;
  db: 'ok' | 'down';
  redis: 'ok' | 'down';
  uptimeSec: number;
  timestamp: string;
}

export interface HealthResult {
  ok: boolean;
  status: 'ok' | 'reachable_but_degraded' | 'unreachable';
  data?: HealthSnapshot;
  error?: string;
  latencyMs: number;
  baseUrl: string;
}

export async function probeHealth(timeoutMs = 5000): Promise<HealthResult> {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { signal: ctrl.signal });
    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      return {
        ok: false,
        status: 'reachable_but_degraded',
        error: `HTTP ${res.status}`,
        latencyMs,
        baseUrl: API_BASE_URL,
      };
    }
    const body = (await res.json()) as { success: boolean; data: HealthSnapshot };
    if (!body.success || body.data.db !== 'ok') {
      return {
        ok: false,
        status: 'reachable_but_degraded',
        data: body.data,
        latencyMs,
        baseUrl: API_BASE_URL,
      };
    }
    return { ok: true, status: 'ok', data: body.data, latencyMs, baseUrl: API_BASE_URL };
  } catch (e: unknown) {
    return {
      ok: false,
      status: 'unreachable',
      error: e instanceof Error ? e.message : String(e),
      latencyMs: Date.now() - t0,
      baseUrl: API_BASE_URL,
    };
  } finally {
    clearTimeout(timer);
  }
}
