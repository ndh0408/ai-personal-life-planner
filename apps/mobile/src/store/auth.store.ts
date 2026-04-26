/**
 * Auth state machine. Stages drive the RootNavigator's branching:
 *   booting → unauthenticated → onboarding → ready
 *
 * Side-effecting flows (login / register / logout) live here so screens
 * stay declarative.
 */
import { create } from 'zustand';
import { apiClient } from '../services/api/client';
import {
  authService,
  type AuthResponse,
  type UserPublic,
} from '../services/auth/auth.service';
import { aiKeyService } from '../services/api/aiKey.service';

export type AuthStage = 'booting' | 'unauthenticated' | 'onboarding' | 'ready';

interface AuthState {
  stage: AuthStage;
  user: UserPublic | null;
  hasAiKey: boolean | null;

  // ── lifecycle ──
  bootstrap: () => Promise<void>;

  // ── credentialed ──
  signIn: (input: { email: string; password: string }) => Promise<void>;
  signUp: (input: { email: string; password: string; displayName?: string }) => Promise<void>;
  signOut: () => Promise<void>;

  // ── onboarding helpers ──
  markBasicSetupDone: () => void;
  markAiKeyConfigured: (configured: boolean) => void;
  finishOnboarding: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  stage: 'booting',
  user: null,
  hasAiKey: null,

  bootstrap: async () => {
    const tokens = await apiClient.hydrate();
    if (!tokens) {
      set({ stage: 'unauthenticated', user: null, hasAiKey: null });
      return;
    }
    try {
      const me = await authService.me();
      const aiKey = await aiKeyService.status().catch(() => null);
      const enabled = aiKey?.enabled ?? false;
      set({
        stage: enabled ? 'ready' : 'onboarding',
        user: me,
        hasAiKey: enabled,
      });
    } catch {
      set({ stage: 'unauthenticated', user: null, hasAiKey: null });
    }
  },

  signIn: async (input) => {
    const res: AuthResponse = await authService.login(input);
    apiClient.setTokens(res.tokens);
    const aiKey = await aiKeyService.status().catch(() => null);
    const enabled = aiKey?.enabled ?? false;
    set({
      stage: enabled ? 'ready' : 'onboarding',
      user: res.user,
      hasAiKey: enabled,
    });
  },

  signUp: async (input) => {
    const res: AuthResponse = await authService.register(input);
    apiClient.setTokens(res.tokens);
    set({ stage: 'onboarding', user: res.user, hasAiKey: false });
  },

  signOut: async () => {
    const tokens = apiClient.getTokens();
    try {
      await authService.logout(tokens?.refreshToken);
    } catch {
      /* swallow — local sign-out always proceeds */
    }
    apiClient.setTokens(null);
    set({ stage: 'unauthenticated', user: null, hasAiKey: null });
  },

  markBasicSetupDone: () => {
    // No server-side step yet; the screen has already saved the profile.
    // Stage stays 'onboarding' until AI key step finishes.
    void get();
  },

  markAiKeyConfigured: (configured) => {
    set((s) => ({ hasAiKey: configured, stage: configured ? 'ready' : s.stage }));
  },

  finishOnboarding: () => {
    set({ stage: 'ready' });
  },
}));

// Wire the api client's session-end signal back into the store.
apiClient.onSessionEnded(() => {
  useAuthStore.setState({ stage: 'unauthenticated', user: null, hasAiKey: null });
});
