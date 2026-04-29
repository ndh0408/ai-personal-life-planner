/**
 * Jest setup for the mobile workspace.
 *
 * - Stubs i18next so components can call `useTranslation()` without the
 *   real init pipeline (which loads JSON resources via the bundler).
 * - Silences a few noisy RN warnings that fire under jsdom-shaped envs.
 */

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => (opts && typeof opts === 'object' && 'defaultValue' in opts ? opts.defaultValue : key),
    i18n: { language: 'vi', changeLanguage: jest.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: () => undefined },
  Trans: ({ children }) => children,
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: {} }),
  NavigationContainer: ({ children }) => children,
}));

// Silence "non-serializable navigation state" warnings in tests.
jest.spyOn(console, 'warn').mockImplementation((msg) => {
  if (typeof msg === 'string' && msg.includes('non-serializable')) return;
  // Otherwise propagate (so real warnings still surface).
});
