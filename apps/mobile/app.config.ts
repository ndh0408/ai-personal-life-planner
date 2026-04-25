import type { ExpoConfig } from '@expo/config-types';

/**
 * Dynamic Expo config for LifeOS AI.
 *
 * App metadata (name, bundle id, version) + environment-dependent values
 * (API URL, env tag) are resolved from process.env at build time so the
 * production bundle can't accidentally ship a localhost URL.
 *
 * Required environment variables at build time:
 *   EXPO_PUBLIC_APP_ENV          development | staging | production
 *   EXPO_PUBLIC_API_BASE_URL     absolute HTTPS URL in staging/production
 *
 * Optional:
 *   EXPO_PUBLIC_APP_VARIANT      suffix on app name + bundle id for side-by-side installs
 */

const APP_ENV = (process.env.EXPO_PUBLIC_APP_ENV ?? 'development') as
  | 'development'
  | 'staging'
  | 'production';

const variantSuffix = (() => {
  if (process.env.EXPO_PUBLIC_APP_VARIANT) {
    return `.${process.env.EXPO_PUBLIC_APP_VARIANT}`;
  }
  if (APP_ENV === 'development') return '.dev';
  if (APP_ENV === 'staging') return '.staging';
  return '';
})();

const displayNameSuffix = (() => {
  if (APP_ENV === 'development') return ' Dev';
  if (APP_ENV === 'staging') return ' Staging';
  return '';
})();

// Resolve API base URL. In production we refuse localhost so a dev build can't
// ship with a host-machine URL baked in.
const rawApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
if (APP_ENV === 'production') {
  if (!rawApiBaseUrl) {
    throw new Error(
      'EXPO_PUBLIC_API_BASE_URL is required for production builds.',
    );
  }
  if (!/^https:\/\//.test(rawApiBaseUrl)) {
    throw new Error(
      `EXPO_PUBLIC_API_BASE_URL must be HTTPS in production (got "${rawApiBaseUrl}").`,
    );
  }
  if (/localhost|127\.0\.0\.1|10\.0\.2\.2/.test(rawApiBaseUrl)) {
    throw new Error(
      `EXPO_PUBLIC_API_BASE_URL may not point at localhost in production (got "${rawApiBaseUrl}").`,
    );
  }
}

const basePackage = 'com.yourname.lifeosai';

const config: ExpoConfig = {
  name: `LifeOS AI${displayNameSuffix}`,
  slug: 'lifeos-ai',
  // Deep-link scheme used by widget Quick Actions + future Siri / App Shortcuts.
  // Routes resolved by `services/widgets/deep-link.ts`.
  scheme: 'lifeos',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0B0B0F',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: `${basePackage}${variantSuffix}`,
    buildNumber: '1',
    // ATS: HTTPS-only in production is already enforced at the env-resolver
    // level; iOS 14+ default policy is compatible with no infoPlist override.
    infoPlist: {
      // Spoken language hint — matches i18n default (vi) + fallback (en).
      CFBundleLocalizations: ['vi', 'en'],
      CFBundleDevelopmentRegion: 'vi',
      // Permission strings — keep short + honest. iOS refuses uploads if
      // these are missing when the matching capability is declared.
      NSUserNotificationsUsageDescription:
        'LifeOS AI sends gentle reminders for your schedule, habits, and daily check-ins. You can turn these off in Settings.',
    },
  },
  android: {
    package: `${basePackage}${variantSuffix}`,
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0B0B0F',
    },
    permissions: ['RECEIVE_BOOT_COMPLETED', 'POST_NOTIFICATIONS', 'VIBRATE'],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: ['expo-notifications', 'expo-localization', 'expo-secure-store'],
  extra: {
    // Kept for backward-compat with older readers; env wins at runtime.
    apiBaseUrl: rawApiBaseUrl,
    appEnv: APP_ENV,
  },
};

export default config;
