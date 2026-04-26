/**
 * Single fetch wrapper that:
 *  - prefixes API_BASE_URL,
 *  - injects Bearer access token,
 *  - parses the standard envelope { success, data, errorCode, message },
 *  - on 401 with a stored refresh, refreshes once and retries the call,
 *  - on missing/expired refresh, clears tokens and throws SessionExpired.
 */
import { API_BASE_URL } from '../config/api';
import { tokenStorage, type StoredTokens } from './storage';

export interface ApiSuccess<T> {
  success: true;
  data: T;
  errorCode: null;
  message: string;
}
export interface ApiError {
  success: false;
  data: null;
  errorCode: string;
  message: string;
  requestId?: string;
}

export class ApiHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly errorCode: string,
    message: string,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiHttpError';
  }
}

export class SessionExpired extends Error {
  constructor() {
    super('Session expired');
    this.name = 'SessionExpired';
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

let memTokens: StoredTokens | null = null;
let refreshInflight: Promise<StoredTokens | null> | null = null;
const onSessionExpiredHandlers = new Set<() => void>();

export const apiClient = {
  /** Hydrate from disk on app boot. */
  async init(): Promise<StoredTokens | null> {
    memTokens = await tokenStorage.load();
    return memTokens;
  },

  setTokens(t: StoredTokens | null) {
    memTokens = t;
    if (t) {
      void tokenStorage.save(t);
    } else {
      void tokenStorage.clear();
    }
  },

  getTokens(): StoredTokens | null {
    return memTokens;
  },

  /** Fired exactly once per "session ended" event so the UI can route to login. */
  onSessionExpired(fn: () => void): () => void {
    onSessionExpiredHandlers.add(fn);
    return () => onSessionExpiredHandlers.delete(fn);
  },

  // ── Core request ────────────────────────────────────────────────────────

  async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    options: { auth?: boolean; timeoutMs?: number } = {},
  ): Promise<T> {
    const auth = options.auth ?? true;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth && memTokens?.accessToken) {
      headers.Authorization = `Bearer ${memTokens.accessToken}`;
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), options.timeoutMs ?? 15_000);

    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
    } catch (e) {
      throw new NetworkError(e instanceof Error ? e.message : 'network');
    } finally {
      clearTimeout(timer);
    }

    // 204 No Content
    if (res.status === 204) return undefined as T;

    let envelope: ApiSuccess<T> | ApiError;
    try {
      envelope = (await res.json()) as ApiSuccess<T> | ApiError;
    } catch {
      throw new ApiHttpError(res.status, 'BAD_RESPONSE', 'Phản hồi không đọc được');
    }

    if (envelope.success) return envelope.data;

    const isUnauth = res.status === 401;
    const isExpiredAccess =
      isUnauth && (envelope.errorCode === 'invalid_token' || envelope.errorCode === 'missing_token');

    if (isExpiredAccess && auth && memTokens?.refreshToken && path !== '/auth/refresh') {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        return this.request<T>(method, path, body, { ...options, auth: true });
      }
    }

    if (isUnauth && auth) {
      // Either refresh failed or the route returned a non-recoverable 401.
      this.signalSessionExpired();
    }

    throw new ApiHttpError(res.status, envelope.errorCode, envelope.message, envelope.requestId);
  },

  // ── Refresh (single-flight) ─────────────────────────────────────────────

  async tryRefresh(): Promise<StoredTokens | null> {
    if (refreshInflight) return refreshInflight;
    if (!memTokens?.refreshToken) return null;
    const refreshToken = memTokens.refreshToken;

    refreshInflight = (async () => {
      try {
        const tokens = await this.request<{ tokens: StoredTokens }>(
          'POST',
          '/auth/refresh',
          { refreshToken },
          { auth: false },
        );
        this.setTokens(tokens.tokens);
        return tokens.tokens;
      } catch {
        this.setTokens(null);
        return null;
      } finally {
        refreshInflight = null;
      }
    })();

    return refreshInflight;
  },

  signalSessionExpired() {
    this.setTokens(null);
    onSessionExpiredHandlers.forEach((fn) => {
      try {
        fn();
      } catch {
        /* listener errors don't propagate */
      }
    });
  },
};
