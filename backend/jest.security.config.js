module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/security'],
  testMatch: [
    '**/security/**/*.test.ts',
    '**/security/**/*.spec.ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/security/setup.ts'],
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  maxWorkers: 1,
  collectCoverage: false,
  // Security test specific settings
  testEnvironmentOptions: {
    node: {
      experimental: {
        wasm: false
      }
    }
  }
};