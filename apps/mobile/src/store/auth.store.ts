import { create } from 'zustand';
import { tokenStore } from '../services/auth/token-store';
import { authApi, type AuthTokens, type Me } from '../services/api/auth.api';
import { registerUnauthorizedHandler } from '../services/api/client';

type Status = 'loading' | 'unauthenticated' | 'authenticated';

type AuthState = {
  status: Status;
  user: Me | null;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; name?: string; timezone?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,

  async hydrate() {
    const token = await tokenStore.getAccess();
    if (!token) {
      set({ status: 'unauthenticated', user: null });
      return;
    }
    try {
      const user = await authApi.me();
      set({ status: 'authenticated', user });
    } catch {
      await tokenStore.clear();
      set({ status: 'unauthenticated', user: null });
    }
  },

  async login(email, password) {
    const tokens = await authApi.login({ email, password });
    await applyTokens(tokens);
    const user = await authApi.me();
    set({ status: 'authenticated', user });
  },

  async register(input) {
    const tokens = await authApi.register(input);
    await applyTokens(tokens);
    const user = await authApi.me();
    set({ status: 'authenticated', user });
  },

  async logout() {
    try {
      await authApi.logout();
    } catch {
      // ignore — clearing tokens is what matters
    }
    await tokenStore.clear();
    set({ status: 'unauthenticated', user: null });
  },

  async refreshMe() {
    if (get().status !== 'authenticated') return;
    try {
      const user = await authApi.me();
      set({ user });
    } catch {
      /* swallow */
    }
  },
}));

async function applyTokens(tokens: AuthTokens) {
  await tokenStore.set(tokens.accessToken, tokens.refreshToken);
}

// Wire 401-from-anywhere → log out
registerUnauthorizedHandler(() => {
  useAuthStore.setState({ status: 'unauthenticated', user: null });
});
