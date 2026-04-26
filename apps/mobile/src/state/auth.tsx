/**
 * Tiny auth store with subscribe semantics — no zustand dependency. Hydrates
 * from AsyncStorage on boot, then drives the App's top-level routing decision.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../api/client';
import { authApi, type UserPublic } from '../api/auth';

export type Stage =
  | 'booting'         // hydrating from disk
  | 'unauthenticated' // show login/register
  | 'needs_ai_key'    // logged in but no key yet — show AI setup
  | 'ready';          // logged in + key (or skipped) — show home

export interface AuthState {
  stage: Stage;
  user: UserPublic | null;
  hasAiKey: boolean | null; // null while unknown
}

interface AuthApi {
  state: AuthState;
  setUser: (user: UserPublic) => void;
  setHasAiKey: (has: boolean) => void;
  /** Mark setup-complete so we leave the AI setup screen (skip or save). */
  finishAiSetup: () => void;
  signOut: (refreshToken?: string) => Promise<void>;
}

const Ctx = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    stage: 'booting',
    user: null,
    hasAiKey: null,
  });

  // Boot: hydrate tokens, fetch user, decide next stage.
  useEffect(() => {
    let alive = true;
    (async () => {
      const tokens = await apiClient.init();
      if (!alive) return;
      if (!tokens) {
        setState({ stage: 'unauthenticated', user: null, hasAiKey: null });
        return;
      }
      try {
        const me = await authApi.me();
        if (!alive) return;
        setState({ stage: 'needs_ai_key', user: me, hasAiKey: false });
      } catch {
        // Token rejected even after refresh — go to login.
        if (!alive) return;
        setState({ stage: 'unauthenticated', user: null, hasAiKey: null });
      }
    })();
    const off = apiClient.onSessionExpired(() => {
      setState({ stage: 'unauthenticated', user: null, hasAiKey: null });
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  const setUser = useCallback((user: UserPublic) => {
    setState((s) => ({ ...s, user, stage: s.hasAiKey ? 'ready' : 'needs_ai_key' }));
  }, []);

  const setHasAiKey = useCallback((has: boolean) => {
    setState((s) => ({ ...s, hasAiKey: has, stage: has ? 'ready' : s.stage }));
  }, []);

  const finishAiSetup = useCallback(() => {
    setState((s) => ({ ...s, stage: 'ready' }));
  }, []);

  const signOut = useCallback(async (refreshToken?: string) => {
    try {
      await authApi.logout(refreshToken);
    } catch {
      /* ignore — local sign-out always proceeds */
    }
    apiClient.setTokens(null);
    setState({ stage: 'unauthenticated', user: null, hasAiKey: null });
  }, []);

  const value = useMemo<AuthApi>(
    () => ({ state, setUser, setHasAiKey, finishAiSetup, signOut }),
    [state, setUser, setHasAiKey, finishAiSetup, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
