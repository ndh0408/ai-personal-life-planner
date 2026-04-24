import { env } from '../../config/env';
import { tokenStore } from '../auth/token-store';
import { getActiveLocale } from '../../i18n';
import type { ApiEnvelope, ApiErrorBody } from '../../types';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: ApiErrorBody | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  auth?: boolean;
  /** Internal: prevents infinite refresh loops. */
  _retry?: boolean;
};

let refreshInFlight: Promise<string | null> | null = null;
let onUnauthorized: (() => void) | null = null;

export function registerUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const refresh = await tokenStore.getRefresh();
      if (!refresh) return null;
      const res = await fetch(`${env.apiBaseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as ApiEnvelope<{
        accessToken: string;
        refreshToken: string;
      }>;
      const { accessToken, refreshToken } = json.data;
      await tokenStore.set(accessToken, refreshToken);
      return accessToken;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function rawFetch<T>(path: string, opts: RequestOptions): Promise<T> {
  const url = path.startsWith('http')
    ? path
    : `${env.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Language': getActiveLocale(),
    ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (opts.auth) {
    const token = await tokenStore.getAccess();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...opts,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch (e) {
    throw new ApiError(0, e instanceof Error ? e.message : 'Network error', null);
  }

  if (res.status === 401 && opts.auth && !opts._retry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return rawFetch<T>(path, { ...opts, _retry: true });
    }
    await tokenStore.clear();
    onUnauthorized?.();
  }

  let body: ApiEnvelope<T> | ApiErrorBody | null = null;
  if (res.status !== 204) {
    try {
      body = (await res.json()) as ApiEnvelope<T> | ApiErrorBody;
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    const message =
      (body && 'message' in body && body.message) || res.statusText || 'Request failed';
    throw new ApiError(res.status, message, body as ApiErrorBody | null);
  }

  if (body && 'success' in body && body.success) {
    return body.data;
  }
  return undefined as T;
}

export const api = {
  get: <T>(path: string, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    rawFetch<T>(path, { ...opts, method: 'GET', auth: opts.auth ?? true }),
  post: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method'> = {}) =>
    rawFetch<T>(path, { ...opts, method: 'POST', body, auth: opts.auth ?? true }),
  put: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method'> = {}) =>
    rawFetch<T>(path, { ...opts, method: 'PUT', body, auth: opts.auth ?? true }),
  patch: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method'> = {}) =>
    rawFetch<T>(path, { ...opts, method: 'PATCH', body, auth: opts.auth ?? true }),
  delete: <T = void>(path: string, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    rawFetch<T>(path, { ...opts, method: 'DELETE', auth: opts.auth ?? true }),
};
