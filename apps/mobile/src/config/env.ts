import Constants from 'expo-constants';

type ExtraConfig = { apiBaseUrl?: string };
const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;

const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
const fromExtra = extra.apiBaseUrl;

if (!fromEnv && !fromExtra && process.env.NODE_ENV === 'production') {
  // Will surface in Metro logs at startup; we still fall back to a safe URL so
  // the bundle doesn't crash, but devs should fix it.
  // eslint-disable-next-line no-console
  console.warn('EXPO_PUBLIC_API_BASE_URL is not set for production build');
}

export const env = {
  apiBaseUrl: fromEnv ?? fromExtra ?? 'http://localhost:3000/api',
  appEnv: process.env.EXPO_PUBLIC_APP_ENV ?? 'development',
};
