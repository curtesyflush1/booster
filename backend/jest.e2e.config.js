const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  displayName: 'E2E Tests',
  testMatch: [
    '**/tests/e2e/**/*.test.ts',
    '**/tests/e2e/**/*.spec.ts'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    'integration',
    'performance',
    'security'
  ],
  // E2E tests need maximum time
  testTimeout: 60000,
  maxWorkers: 1, // Sequential execution
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.ts',
    '<rootDir>/tests/e2e/setup.ts'
  ],
  // No coverage collection for E2E tests
  collectCoverage: false
};