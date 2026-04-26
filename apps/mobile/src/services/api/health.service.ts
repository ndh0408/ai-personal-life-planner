import { apiClient } from './client';
import { API_BASE_URL } from './config';

export interface HealthSnapshot {
  service: string;
  version: string;
  db: 'ok' | 'down';
  redis: 'ok' | 'down';
  uptimeSec: number;
  timestamp: string;
}

export interface HealthResult {
  status: 'ok' | 'degraded' | 'unreachable';
  data?: HealthSnapshot;
  error?: string;
  latencyMs: number;
  baseUrl: string;
}

export const healthService = {
  async probe(timeoutMs = 5000): Promise<HealthResult> {
    const t0 = Date.now();
    try {
      const data = await apiClient.request<HealthSnapshot>('GET', '/health', undefined, {
        auth: false,
        timeoutMs,
      });
      const latencyMs = Date.now() - t0;
      return {
        status: data.db === 'ok' && data.redis === 'ok' ? 'ok' : 'degraded',
        data,
        latencyMs,
        baseUrl: API_BASE_URL,
      };
    } catch (e) {
      return {
        status: 'unreachable',
        error: e instanceof Error ? e.message : String(e),
        latencyMs: Date.now() - t0,
        baseUrl: API_BASE_URL,
      };
    }
  },
};
