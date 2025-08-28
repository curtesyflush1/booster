module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/performance'],
  testMatch: [
    '**/performance/**/*.test.ts',
    '**/performance/**/*.spec.ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/performance/setup.ts'],
  testTimeout: 120000, // 2 minutes for performance tests
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  maxWorkers: 1, // Run performance tests sequentially
  collectCoverage: false, // Don't collect coverage for performance tests
  detectOpenHandles: false,
  // Performance test specific settings
  testEnvironmentOptions: {
    node: {
      experimental: {
        wasm: false
      }
    }
  },
  // Custom reporters for performance metrics
  reporters: [
    'default',
    ['<rootDir>/tests/performance/performanceReporter.js', {}]
  ]
};