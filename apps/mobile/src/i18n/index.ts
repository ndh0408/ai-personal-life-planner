/**
 * Tiny i18n: pick a catalog by locale, expose a `t(path, vars?)` function via
 * a React context. No external library — keeps the dev loop fast and the
 * bundle small. Catalogs must stay structurally identical (vi parity = en).
 */
import { NativeModules, Platform } from 'react-native';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import vi from './locales/vi.json';
import en from './locales/en.json';

export type Locale = 'vi' | 'en';
const CATALOGS = { vi, en } as const;
type Catalog = typeof vi;

function detectLocale(): Locale {
  const sys =
    Platform.OS === 'ios'
      ? NativeModules.SettingsManager?.settings?.AppleLocale ??
        NativeModules.SettingsManager?.settings?.AppleLanguages?.[0]
      : NativeModules.I18nManager?.localeIdentifier;
  return typeof sys === 'string' && sys.toLowerCase().startsWith('vi') ? 'vi' : 'en';
}

function lookup(catalog: Catalog, path: string): string {
  const segments = path.split('.');
  let cur: unknown = catalog;
  for (const seg of segments) {
    if (cur && typeof cur === 'object' && seg in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[seg];
    } else {
      return path; // missing key — surface the path so it's obvious in dev
    }
  }
  return typeof cur === 'string' ? cur : path;
}

function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{\{(\w+)\}\}/g, (_, k: string) =>
    k in vars ? String(vars[k]) : `{{${k}}}`,
  );
}

interface I18nValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (path: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(detectLocale);
  const t = useCallback(
    (path: string, vars?: Record<string, string | number>) =>
      interpolate(lookup(CATALOGS[locale], path), vars),
    [locale],
  );
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, t]);
  return React.createElement(I18nContext.Provider, { value }, children);
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
