import { create } from 'zustand';
import { tokenStore } from '../services/auth/token-store';
import { authApi, type AuthTokens, type Me } from '../services/api/auth.api';
import { profileApi, type ProfilePayload } from '../services/api/profile.api';
import { registerUnauthorizedHandler } from '../services/api/client';
import { queryClient } from '../services/query-client';
import { setLocale, type SupportedLocale } from '../i18n';

type Status = 'loading' | 'unauthenticated' | 'authenticated';

type AuthState = {
  status: Status;
  user: Me | null;
  profile: ProfilePayload | null;
  /** True when authenticated but no UserProfile row yet → show onboarding. */
  needsOnboarding: boolean;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; name?: string; timezone?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  completeOnboarding: (profile: ProfilePayload) => void;
};

async function bootProfile() {
  // Server /profile returns { profile, exists } — exists=false means the row
  // was never created, so the user needs onboarding. The auth.service upsert-
  // path writes an empty profile at register, so exists should always be true
  // in that case; but we fall back to "no data" treatment (all fields null +
  // fullName === displayName) to trigger onboarding too.
  try {
    const { profile, exists } = await profileApi.get();
    const isSkeleton =
      !exists ||
      !profile ||
      (profile.age === null &&
        profile.mainGoal === null &&
        profile.activityLevel === null &&
        profile.usualWakeTime === null);
    return { profile: profile ?? null, needsOnboarding: isSkeleton };
  } catch {
    return { profile: null, needsOnboarding: true };
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,
  profile: null,
  needsOnboarding: false,

  async hydrate() {
    const token = await tokenStore.getAccess();
    if (!token) {
      set({ status: 'unauthenticated', user: null, profile: null, needsOnboarding: false });
      return;
    }
    try {
      const user = await authApi.me();
      const { profile, needsOnboarding } = await bootProfile();
      if (profile?.locale) {
        await setLocale(profile.locale as SupportedLocale).catch(() => undefined);
      }
      set({ status: 'authenticated', user, profile, needsOnboarding });
    } catch {
      await tokenStore.clear();
      set({ status: 'unauthenticated', user: null, profile: null, needsOnboarding: false });
    }
  },

  async login(email, password) {
    const tokens = await authApi.login({ email, password });
    await applyTokens(tokens);
    const user = await authApi.me();
    const { profile, needsOnboarding } = await bootProfile();
    if (profile?.locale) {
      await setLocale(profile.locale as SupportedLocale).catch(() => undefined);
    }
    set({ status: 'authenticated', user, profile, needsOnboarding });
  },

  async register(input) {
    const tokens = await authApi.register(input);
    await applyTokens(tokens);
    const user = await authApi.me();
    // Fresh registers always need onboarding — the backend creates an empty
    // UserProfile row but every optional field is null.
    set({ status: 'authenticated', user, profile: null, needsOnboarding: true });
  },

  async logout() {
    try {
      await authApi.logout();
    } catch {
      // ignore — clearing tokens is what matters
    }
    await wipeClientState();
    set({ status: 'unauthenticated', user: null, profile: null, needsOnboarding: false });
  },

  async refreshProfile() {
    if (get().status !== 'authenticated') return;
    const { profile, needsOnboarding } = await bootProfile();
    set({ profile, needsOnboarding });
  },

  completeOnboarding(profile) {
    set({ profile, needsOnboarding: false });
  },
}));

async function applyTokens(tokens: AuthTokens) {
  await tokenStore.set(tokens.accessToken, tokens.refreshToken);
}

// Full client-side teardown — must be identical between explicit `logout()`
// and the 401 reactive handler so a server-forced sign-out cannot leave a
// stale widget snapshot, offline cache, or react-query entry behind.
async function wipeClientState(): Promise<void> {
  await tokenStore.clear().catch(() => undefined);
  try {
    const { resetOfflineState } = await import('../services/offline');
    await resetOfflineState();
  } catch {
    // Best-effort — never block teardown on cache purge.
  }
  try {
    const { widgetSnapshotStore } = await import('../services/widgets/snapshot-store');
    await widgetSnapshotStore.clear();
  } catch {
    // Best-effort.
  }
  try {
    await queryClient.cancelQueries();
    queryClient.clear();
  } catch {
    // Best-effort.
  }
}

// Wire 401-from-anywhere → log out + wipe ALL client state (same teardown
// as explicit logout). Fire-and-forget; UI flips to unauthenticated
// immediately so the user is not stuck on a protected screen.
registerUnauthorizedHandler(() => {
  void wipeClientState();
  useAuthStore.setState({ status: 'unauthenticated', user: null, profile: null, needsOnboarding: false });
});
