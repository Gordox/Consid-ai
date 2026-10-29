/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  // jest-expo enables this by default; a test run that finds no tests must fail.
  passWithNoTests: false,
  // Lucide ships its per-icon files as ES modules, which Jest does not load. No test asserts on
  // icon rendering, so every icon resolves to an empty component.
  moduleNameMapper: {
    '^lucide-react-native/icons/.*$': '<rootDir>/tests/support/iconStub.js',
  },
};
