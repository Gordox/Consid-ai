/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  // jest-expo enables this by default; a test run that finds no tests must fail.
  passWithNoTests: false,
};
