import Constants from 'expo-constants';

type ExtraConfig = { apiBaseUrl?: string; appEnv?: string };
const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;

const APP_ENV = (process.env.EXPO_PUBLIC_APP_ENV ?? extra.appEnv ?? 'development') as
  | 'development'
  | 'staging'
  | 'production';

const IS_PRODUCTION = APP_ENV === 'production';

// Resolution order:
//   1. EXPO_PUBLIC_API_BASE_URL (from .env at build time)
//   2. app.config.ts `extra.apiBaseUrl`
//   3. Dev-only local fallback (localhost)
const rawApiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? extra.apiBaseUrl ?? undefined;

const DEV_FALLBACK_URL = 'http://localhost:3000/api';

function resolveApiBaseUrl(): string {
  if (IS_PRODUCTION) {
    if (!rawApiBaseUrl) {
      throw new Error(
        'EXPO_PUBLIC_API_BASE_URL must be set for production builds.',
      );
    }
    if (!/^https:\/\//.test(rawApiBaseUrl)) {
      throw new Error(
        'EXPO_PUBLIC_API_BASE_URL must be HTTPS in production.',
      );
    }
    return rawApiBaseUrl;
  }
  return rawApiBaseUrl ?? DEV_FALLBACK_URL;
}

export const env = {
  appEnv: APP_ENV,
  isProduction: IS_PRODUCTION,
  isStaging: APP_ENV === 'staging',
  isDevelopment: APP_ENV === 'development',
  apiBaseUrl: resolveApiBaseUrl(),
};
