/**
 * Jest setup file for test environment configuration
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'sqlite::memory:';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.LOG_LEVEL = 'error';
process.env.ENCRYPTION_KEY = 'test_encryption_key_must_be_32_characters_long';

// Mock external services to prevent network calls
jest.mock('axios');
jest.mock('nodemailer');
jest.mock('web-push');

// Comprehensive Winston mock
jest.mock('winston', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    log: jest.fn()
  };
  
  const mockFormat = jest.fn(() => mockFormat);
  mockFormat.combine = jest.fn(() => mockFormat);
  mockFormat.timestamp = jest.fn(() => mockFormat);
  mockFormat.errors = jest.fn(() => mockFormat);
  mockFormat.json = jest.fn(() => mockFormat);
  mockFormat.colorize = jest.fn(() => mockFormat);
  mockFormat.simple = jest.fn(() => mockFormat);
  mockFormat.printf = jest.fn(() => mockFormat);
  
  const mockTransport = jest.fn();
  
  return {
    createLogger: jest.fn(() => mockLogger),
    format: mockFormat,
    transports: {
      Console: mockTransport,
      File: mockTransport
    }
  };
});

// Mock Redis
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    ping: jest.fn().mockResolvedValue('PONG'),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    expire: jest.fn().mockResolvedValue(1),
    on: jest.fn(),
    off: jest.fn(),
    quit: jest.fn().mockResolvedValue('OK')
  }))
}));

// Note: database module is mocked per-test where needed to avoid global side effects

// Mock Knex database
jest.mock('knex', () => {
  const mockKnex = jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    then: jest.fn().mockResolvedValue([]),
    catch: jest.fn().mockReturnThis(),
    transaction: jest.fn().mockImplementation(async (callback) => {
      const mockTransaction = {
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
        then: jest.fn().mockResolvedValue([]),
        catch: jest.fn().mockReturnThis()
      };
      return await callback(mockTransaction);
    }),
    migrate: {
      latest: jest.fn().mockResolvedValue([]),
      rollback: jest.fn().mockResolvedValue([])
    },
    seed: {
      run: jest.fn().mockResolvedValue([])
    },
    destroy: jest.fn().mockResolvedValue(undefined)
  }));
  
  mockKnex.mockReturnValue(mockKnex());
  return mockKnex;
});

// Mock setInterval to prevent background processes from running during tests
const originalSetInterval = global.setInterval;
global.setInterval = jest.fn((callback, delay) => {
  // Only allow setInterval if it's explicitly needed for tests
  if (process.env.ALLOW_INTERVALS === 'true') {
    return originalSetInterval(callback, delay);
  }
  // Return a mock interval ID for tests
  return 999999;
});

// Mock clearInterval to prevent issues with mock intervals
const originalClearInterval = global.clearInterval;
global.clearInterval = jest.fn((intervalId) => {
  if (process.env.ALLOW_INTERVALS === 'true') {
    return originalClearInterval(intervalId);
  }
  // Do nothing for mock intervals
});

// Use actual KMS factory in unit tests to validate configuration logic
jest.mock('../src/utils/encryption/kms/factory', () => {
  return jest.requireActual('../src/utils/encryption/kms/factory');
});

// Global test timeout
jest.setTimeout(15000);

// Suppress console output in tests
const originalConsole = { ...console };
console.error = jest.fn();
console.warn = jest.fn();
console.log = jest.fn();
console.info = jest.fn();
console.debug = jest.fn();

// Test database harness
const { initializeDatabase, closeDatabaseConnection } = require('./helpers/testDatabase');

// Global test setup and teardown
if (typeof beforeAll === 'function' && typeof afterAll === 'function') {
  beforeAll(async () => {
    await initializeDatabase();
  });

  afterAll(async () => {
    await closeDatabaseConnection();
  });
}

// Restore console after tests if needed
global.restoreConsole = () => {
  Object.assign(console, originalConsole);
};
