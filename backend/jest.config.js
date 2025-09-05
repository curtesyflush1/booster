module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    'integration',
    'e2e',
    'performance',
    'security',
    'controllers'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/**/__tests__/**',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/types/**/*.ts', // Exclude type definitions
    '!src/config/database.ts', // Exclude until database mocking is fixed
    '!src/**/__mocks__/**', // Exclude mock files
    '!src/**/migrations/**', // Exclude migration files
    '!src/**/seeds/**' // Exclude seed files
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 65,
      statements: 65
    },
    './src/controllers/': {
      branches: 70,
      functions: 80,
      lines: 75,
      statements: 75
    },
    './src/services/': {
      branches: 65,
      functions: 75,
      lines: 70,
      statements: 70
    },
    './src/models/': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  testTimeout: 15000, // Reduced from 30s for faster feedback
  verbose: false,
  forceExit: true,
  clearMocks: true,
  resetMocks: false,
  restoreMocks: true,
  detectOpenHandles: true, // Enable to catch resource leaks
  maxWorkers: '50%', // Use half available cores for better performance
  // Prevent memory leaks
  logHeapUsage: true, // Enable to monitor memory usage
  // Add error handling for better debugging
  errorOnDeprecated: true,
  // Improve test isolation
  // isolatedModules: true, // Commented out due to validation warning
  // Module name mapping for better imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  // Improved module mocking
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  // Transform configuration for better TypeScript support
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))'
  ],
  // Global setup for test environment
  globalSetup: '<rootDir>/tests/globalSetup.ts',
  globalTeardown: '<rootDir>/tests/globalTeardown.ts'
};
