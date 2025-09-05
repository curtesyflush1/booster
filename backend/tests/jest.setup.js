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
  // Build a chainable query builder stub
  const createBuilder = () => ({
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    join: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    del: jest.fn().mockReturnThis(),
    count: jest.fn().mockResolvedValue([{ count: 0 }]),
    avg: jest.fn().mockResolvedValue([{ avg: 0 }]),
    sum: jest.fn().mockResolvedValue([{ sum: 0 }]),
    max: jest.fn().mockResolvedValue([{ max: 0 }]),
    min: jest.fn().mockResolvedValue([{ min: 0 }]),
    groupBy: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    returning: jest.fn().mockResolvedValue([{ id: 'test-id' }]),
    then: jest.fn().mockResolvedValue([]),
    catch: jest.fn().mockReturnThis()
  });

  const knexFactory = jest.fn((_config) => {
    // Return a callable function that acts as knex instance
    const builder = createBuilder();
    const callable = ((table) => {
      // ignore table and return a fresh builder per call
      return createBuilder();
    });

    // Attach common methods on the instance
    callable.raw = jest.fn().mockResolvedValue({ rows: [] });
    callable.transaction = jest.fn().mockImplementation(async (cb) => {
      const trx = {
        ...createBuilder(),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined)
      };
      const res = await cb(trx);
      return res;
    });
    callable.migrate = {
      latest: jest.fn().mockResolvedValue([]),
      rollback: jest.fn().mockResolvedValue([])
    };
    callable.seed = { run: jest.fn().mockResolvedValue([]) };
    callable.destroy = jest.fn().mockResolvedValue(undefined);
    return callable;
  });

  // Export types compatibility
  knexFactory.Knex = {};
  return knexFactory;
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
jest.setTimeout(30000);

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

// Mock monitoring service to avoid side effects during import
jest.mock('../src/services/monitoringService', () => ({
  monitoringService: {
    on: jest.fn(),
    recordMetric: jest.fn(),
    getMetrics: jest.fn(() => []),
  }
}));

// Enable test bypass for auth and disable rate limiters globally for tests
process.env.TEST_BYPASS_AUTH = 'true';
process.env.TEST_DISABLE_RATE_LIMIT = 'true';

// Mock retailer service classes as jest fns to support constructor mocking in tests
jest.mock('../src/services/retailers/BestBuyService', () => {
  const Impl = jest.fn().mockImplementation(() => ({
    checkAvailability: jest.fn(),
    searchProducts: jest.fn(),
    getHealthStatus: jest.fn(),
    getMetrics: jest.fn(),
    getConfig: jest.fn()
  }));
  return { BestBuyService: Impl };
});

jest.mock('../src/services/retailers/WalmartService', () => {
  const Impl = jest.fn().mockImplementation(() => ({
    checkAvailability: jest.fn(),
    searchProducts: jest.fn(),
    getHealthStatus: jest.fn(),
    getMetrics: jest.fn(),
    getConfig: jest.fn()
  }));
  return { WalmartService: Impl };
});

jest.mock('../src/services/retailers/CostcoService', () => {
  const Impl = jest.fn().mockImplementation(() => ({
    checkAvailability: jest.fn(),
    searchProducts: jest.fn(),
    getHealthStatus: jest.fn(),
    getMetrics: jest.fn(),
    getConfig: jest.fn()
  }));
  return { CostcoService: Impl };
});

jest.mock('../src/services/retailers/SamsClubService', () => {
  const Impl = jest.fn().mockImplementation(() => ({
    checkAvailability: jest.fn(),
    searchProducts: jest.fn(),
    getHealthStatus: jest.fn(),
    getMetrics: jest.fn(),
    getConfig: jest.fn()
  }));
  return { SamsClubService: Impl };
});

// Restore console after tests if needed
global.restoreConsole = () => {
  Object.assign(console, originalConsole);
};
