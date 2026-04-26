/**
 * The single fetch wrapper used by every screen and every TanStack Query hook.
 *
 * Responsibilities:
 *  - prefix API_BASE_URL,
 *  - attach Authorization: Bearer <accessToken>,
 *  - parse the standard envelope and unwrap data / throw ApiHttpError,
 *  - on 401 (invalid_token / missing_token), refresh once (single-flight)
 *    and retry the original call,
 *  - on missing/expired refresh, fire onSessionEnded so the auth store
 *    can tear down and route to login.
 */
import { secureStorage, type SecureTokens } from '../storage/secure';
import { API_BASE_URL } from './config';
import { ApiHttpError, NetworkError, type ApiEnvelope } from './errors';

type SessionEndHandler = () => void;

let memTokens: SecureTokens | null = null;
let refreshInflight: Promise<SecureTokens | null> | null = null;
const sessionEndedHandlers = new Set<SessionEndHandler>();

export const apiClient = {
  async hydrate(): Promise<SecureTokens | null> {
    memTokens = await secureStorage.loadTokens();
    return memTokens;
  },

  setTokens(t: SecureTokens | null): void {
    memTokens = t;
    if (t) {
      void secureStorage.saveTokens(t);
    } else {
      void secureStorage.clearTokens();
    }
  },

  getTokens(): SecureTokens | null {
    return memTokens;
  },

  onSessionEnded(fn: SessionEndHandler): () => void {
    sessionEndedHandlers.add(fn);
    return () => sessionEndedHandlers.delete(fn);
  },

  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    options: { auth?: boolean; timeoutMs?: number; headers?: Record<string, string> } = {},
  ): Promise<T> {
    const auth = options.auth ?? true;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    };
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

    if (res.status === 204) return undefined as T;

    let envelope: ApiEnvelope<T>;
    try {
      envelope = (await res.json()) as ApiEnvelope<T>;
    } catch {
      throw new ApiHttpError(res.status, 'BAD_RESPONSE', 'Phản hồi không đọc được');
    }

    if (envelope.success) return envelope.data;

    const isUnauth = res.status === 401;
    const recoverable = envelope.errorCode === 'invalid_token' || envelope.errorCode === 'missing_token';

    if (isUnauth && recoverable && auth && memTokens?.refreshToken && path !== '/auth/refresh') {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        return this.request<T>(method, path, body, { ...options, auth: true });
      }
    }

    if (isUnauth && auth) {
      this.tearDownSession();
    }

    throw new ApiHttpError(res.status, envelope.errorCode, envelope.message, envelope.requestId);
  },

  async tryRefresh(): Promise<SecureTokens | null> {
    if (refreshInflight) return refreshInflight;
    if (!memTokens?.refreshToken) return null;
    const refreshToken = memTokens.refreshToken;

    refreshInflight = (async () => {
      try {
        const out = await this.request<{ tokens: SecureTokens }>(
          'POST',
          '/auth/refresh',
          { refreshToken },
          { auth: false },
        );
        this.setTokens(out.tokens);
        return out.tokens;
      } catch {
        this.setTokens(null);
        return null;
      } finally {
        refreshInflight = null;
      }
    })();

    return refreshInflight;
  },

  tearDownSession(): void {
    this.setTokens(null);
    for (const fn of sessionEndedHandlers) {
      try {
        fn();
      } catch {
        /* listener errors don't propagate */
      }
    }
  },
};
