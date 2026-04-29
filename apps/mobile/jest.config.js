/**
 * Jest config for the mobile workspace (round 27).
 *
 * Uses the official react-native preset for the Babel + transform setup.
 * `transformIgnorePatterns` is widened so jest will run the babel transform
 * over the small set of node_modules that publish ESM (react-native +
 * the navigation libs).
 *
 * The ___mocks___ folder stubs out native-only modules (vector icons,
 * svg, reanimated, async-storage, keychain, etc) so component tests can
 * mount without the RN runtime.
 */
module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  testMatch: ['<rootDir>/src/**/*.spec.{ts,tsx}', '<rootDir>/src/**/*.test.{ts,tsx}'],
  moduleNameMapper: {
    '^react-native-vector-icons/(.*)$': '<rootDir>/__mocks__/empty.js',
    '^react-native-svg$': '<rootDir>/__mocks__/empty.js',
    '^react-native-reanimated$': '<rootDir>/__mocks__/empty.js',
    '^react-native-gesture-handler$': '<rootDir>/__mocks__/empty.js',
    '^react-native-keychain$': '<rootDir>/__mocks__/empty.js',
    '^react-native-localize$': '<rootDir>/__mocks__/empty.js',
    '^react-native-sse$': '<rootDir>/__mocks__/empty.js',
    '^@react-native-async-storage/async-storage$': '<rootDir>/__mocks__/empty.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-.*)/)',
  ],
};
