const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  displayName: 'Integration Tests',
  testMatch: [
    '**/tests/integration/**/*.test.ts',
    '**/tests/integration/**/*.spec.ts'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    'e2e',
    'performance',
    'security'
  ],
  // Integration tests need more time and resources
  testTimeout: 30000,
  maxWorkers: 1, // Sequential execution for database tests
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.ts',
    '<rootDir>/tests/integration/setup.ts'
  ],
  // Lower coverage thresholds for integration tests
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 60,
      lines: 55,
      statements: 55
    }
  }
};