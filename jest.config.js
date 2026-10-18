module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/tests', '<rootDir>/src', '<rootDir>/modules'],
  testMatch: ['<rootDir>/tests/ui/**/*.test.tsx'],
  setupFiles: ['<rootDir>/jest.storage-boundary.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  haste: { defaultPlatform: 'android', platforms: ['android', 'ios', 'native'] },
  watchman: false,
  modulePathIgnorePatterns: ['<rootDir>/.cache/', '<rootDir>/.superpowers/', '<rootDir>/ios/build/', '<rootDir>/android/app/build/'],
  maxWorkers: 1,
  clearMocks: true,
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|query-string-upstream|decode-uri-component|split-on-first|filter-obj))',
    '/node_modules/react-native-reanimated/plugin/',
  ],
  testTimeout: 15000,
};
