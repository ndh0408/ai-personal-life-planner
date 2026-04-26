import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as RNLocalize from 'react-native-localize';
import vi from './locales/vi.json';
import en from './locales/en.json';

export type Locale = 'vi' | 'en';

function detectLocale(): Locale {
  const best = RNLocalize.findBestLanguageTag(['vi', 'en']);
  return best?.languageTag === 'vi' ? 'vi' : 'en';
}

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      vi: { translation: vi },
      en: { translation: en },
    },
    lng: detectLocale(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
    compatibilityJSON: 'v4',
  });

export { i18n };
