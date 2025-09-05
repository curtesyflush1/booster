const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  displayName: 'Integration Tests (DB-backed)',
  // Start small: include DB smoke + migration + auth smoke. Expand as suites stabilize.
  testMatch: [
    '**/tests/integration/db-*.test.ts',
    '**/tests/integration/migration.test.ts'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    // Do not ignore integration suites here
  ],
  // DB-backed integration needs more time and runs sequentially
  testTimeout: 60000,
  maxWorkers: 1,
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.ts',
    '<rootDir>/tests/integration/setup.ts'
  ],
  // Lower thresholds for integration
  coverageThreshold: {
    global: {
      branches: 40,
      functions: 50,
      lines: 50,
      statements: 50
    }
  }
};
