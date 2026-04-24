import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import en from './locales/en.json';
import vi from './locales/vi.json';

export const SUPPORTED_LOCALES = ['vi', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'vi';
export const FALLBACK_LOCALE: SupportedLocale = 'en';
const STORAGE_KEY = 'lifeos.locale';

function isSupported(value: string | null | undefined): value is SupportedLocale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Device-locale detection — we only care about the base tag ("vi-VN" → "vi").
 * If the device is set to anything other than our two supported tags, we
 * default to Vietnamese per the product spec.
 */
export function detectDeviceLocale(): SupportedLocale {
  const locales = Localization.getLocales();
  for (const l of locales) {
    const tag = (l.languageCode ?? '').toLowerCase();
    if (isSupported(tag)) return tag;
  }
  return DEFAULT_LOCALE;
}

/**
 * Resolve the active locale at startup:
 *   1. AsyncStorage (user-selected) — wins if valid
 *   2. Device locale — if it's one of our supported tags
 *   3. Default: "vi"
 */
async function resolveInitialLocale(): Promise<SupportedLocale> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (isSupported(stored)) return stored;
  } catch {
    // AsyncStorage can fail on a fresh install — fall through to detect.
  }
  return detectDeviceLocale();
}

export async function initI18n(): Promise<SupportedLocale> {
  const initial = await resolveInitialLocale();
  await i18n.use(initReactI18next).init({
    resources: {
      vi: { translation: vi },
      en: { translation: en },
    },
    lng: initial,
    fallbackLng: FALLBACK_LOCALE,
    interpolation: { escapeValue: false },
    returnNull: false,
    compatibilityJSON: 'v3', // React Native intl polyfill
  });
  return initial;
}

/**
 * Change the active locale, persist it, and keep the in-memory i18n instance
 * in sync. Components that need to react should use `useTranslation()` —
 * changing the language triggers a re-render automatically.
 */
export async function setLocale(locale: SupportedLocale): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, locale);
  await i18n.changeLanguage(locale);
}

export function getActiveLocale(): SupportedLocale {
  const current = (i18n.language ?? DEFAULT_LOCALE).split('-')[0];
  return isSupported(current) ? current : DEFAULT_LOCALE;
}

export default i18n;
