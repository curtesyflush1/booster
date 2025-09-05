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
jest.mock('axios', () => {
  const http = {
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    },
    get: jest.fn().mockResolvedValue({ data: '', status: 200, headers: {}, config: {}, request: {} }),
    post: jest.fn().mockResolvedValue({ data: '', status: 200, headers: {}, config: {}, request: {} })
  };
  return {
    create: jest.fn(() => http),
    __esModule: true,
    default: { create: jest.fn(() => http) }
  };
});
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
  // In-memory store to simulate minimal DB behavior across calls
  const store = new Map(); // table -> Array<Record<string, any>>
  // Expose for test resets
  // @ts-ignore
  if (typeof global !== 'undefined') {
    // @ts-ignore
    global.__KNEX_TEST_STORE__ = store;
  }

  // Simple per-table id counters to generate unique ids
  const idCounters = new Map(); // table -> number

  // Build a chainable query builder stub (scoped to a table)
  const createBuilder = (tableName) => {
    if (!store.has(tableName)) store.set(tableName, []);
    if (!idCounters.has(tableName)) idCounters.set(tableName, 0);
    const table = store.get(tableName);
    const builder = {
      __lastInsert: undefined,
      __lastInsertRow: undefined,
      __whereCriteria: undefined,
      __filters: [],
      __orFilters: [],
      __groups: [],
      __orderBy: undefined,
      __offset: 0,
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn(function (arg1, arg2, arg3) {
        if (typeof arg1 === 'function') {
          // Capture inner filters for grouped expression
          const prevF = this.__filters.length;
          const prevO = this.__orFilters.length;
          arg1.call(this);
          const innerFilters = this.__filters.splice(prevF);
          const innerOr = this.__orFilters.splice(prevO);
          const groupPred = (row) => {
            const andOk = innerFilters.every(fn => fn(row));
            const orOk = (innerOr.length === 0) || innerOr.some(fn => fn(row));
            // If inner ORs present, allow either OR or all ANDs to satisfy
            return innerOr.length > 0 ? (orOk || andOk) : andOk;
          };
          this.__groups.push(groupPred);
          return this;
        }
        if (typeof arg1 === 'object' && arg1 !== null) {
          this.__whereCriteria = arg1;
          this.__filters.push((row) => Object.keys(arg1).every(k => row[k] === arg1[k]));
          return this;
        }
        const column = arg1;
        let operator = '='; let value;
        if (arguments.length === 2) { value = arg2; } else { operator = String(arg2).toLowerCase(); value = arg3; }
        if (operator === '=' || operator === '==') {
          this.__filters.push((row) => row[column] === value);
        } else if (operator === 'ilike' || operator === 'like') {
          const pattern = String(value).toLowerCase().replace(/%/g, '');
          this.__filters.push((row) => String(row[column] || '').toLowerCase().includes(pattern));
        } else if (operator === '>=') {
          this.__filters.push((row) => (row[column] || 0) >= value);
        } else if (operator === '<=') {
          this.__filters.push((row) => (row[column] || 0) <= value);
        } else if (operator === '>') {
          this.__filters.push((row) => (row[column] || 0) > value);
        } else if (operator === '<') {
          this.__filters.push((row) => (row[column] || 0) < value);
        } else {
          this.__filters.push((row) => row[column] === value);
        }
        return this;
      }),
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn(function (arg1, arg2, arg3) {
        if (typeof arg1 === 'object' && arg1 !== null) {
          this.__orFilters.push((row) => Object.keys(arg1).every(k => row[k] === arg1[k]));
          return this;
        }
        const column = arg1; let operator = '='; let value;
        if (arguments.length === 2) { value = arg2; } else { operator = String(arg2).toLowerCase(); value = arg3; }
        if (operator === 'ilike' || operator === 'like') {
          const pattern = String(value).toLowerCase().replace(/%/g, '');
          this.__orFilters.push((row) => String(row[column] || '').toLowerCase().includes(pattern));
        } else {
          this.__orFilters.push((row) => row[column] === value);
        }
        return this;
      }),
      whereRaw: jest.fn(function (sql, params) {
        const s = String(sql || '');
        if (/ANY\(product_ids\)/i.test(s) && Array.isArray(params) && params.length > 0) {
          const needle = params[0];
          this.__filters.push((row) => Array.isArray(row.product_ids) && row.product_ids.includes(needle));
        }
        return this;
      }),
      orWhereRaw: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      join: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      orderBy: jest.fn(function (col, dir) { this.__orderBy = { col, dir: (dir || 'asc').toLowerCase() }; return this; }),
      limit: jest.fn(function (n) { const rows = this.__evaluate(); const out = rows.slice(this.__offset || 0, (this.__offset || 0) + n); return Promise.resolve(out); }),
      offset: jest.fn(function (n) { this.__offset = n; return this; }),
      insert: jest.fn(function (data) { 
        this.__lastInsert = data; 
        const now = new Date();
        // Generate a unique id per table (UUID-like tail varies)
        const c = idCounters.get(tableName) + 1; idCounters.set(tableName, c);
        const suffix = String(c % 0x10000).toString(16).padStart(4, '0');
        const row = {
          id: `550e8400-e29b-41d4-a716-44665544${suffix}`,
          ...data,
          created_at: data?.created_at || now,
          updated_at: data?.updated_at || now
        };
        table.push(row);
        this.__lastInsertRow = row;
        return this; 
      }),
      update: jest.fn(function (data) { this.__updateData = data; return this; }),
      del: jest.fn().mockReturnThis(),
      count: jest.fn(function () { return Promise.resolve([{ count: this.__evaluate().length }]); }),
      countDistinct: jest.fn(function () { const rows = this.__evaluate(); const ids = new Set(rows.map(r => r && r.id)); return Promise.resolve([{ count: ids.size }]); }),
      avg: jest.fn().mockResolvedValue([{ avg: 0 }]),
      sum: jest.fn().mockResolvedValue([{ sum: 0 }]),
      max: jest.fn().mockResolvedValue([{ max: 0 }]),
      min: jest.fn().mockResolvedValue([{ min: 0 }]),
      groupBy: jest.fn().mockReturnThis(),
      clone: jest.fn(function () {
        const dup = createBuilder(tableName);
        dup.__filters = this.__filters.slice();
        dup.__orFilters = this.__orFilters.slice();
        dup.__groups = this.__groups.slice();
        dup.__whereCriteria = this.__whereCriteria ? { ...this.__whereCriteria } : undefined;
        dup.__orderBy = this.__orderBy ? { ...this.__orderBy } : undefined;
        dup.__offset = this.__offset;
        return dup;
      }),
      clearSelect: jest.fn().mockReturnThis(),
      clearOrder: jest.fn().mockReturnThis(),
      clearWhere: jest.fn().mockReturnThis(),
      first: jest.fn(function () {
        if (this.__whereCriteria && typeof this.__whereCriteria === 'object') {
          const keys = Object.keys(this.__whereCriteria);
          const found = table.find(r => keys.every(k => r[k] === this.__whereCriteria[k]));
          return Promise.resolve(found || null);
        }
        const rows = this.__evaluate();
        return Promise.resolve(rows[0] || null);
      }),
      returning: jest.fn(function () {
        // Handle insert
        if (this.__lastInsertRow) {
          return Promise.resolve([this.__lastInsertRow]);
        }
        // Handle update (by id or criteria)
        if (this.__updateData) {
          const now = new Date();
          let target = null;
          if (this.__whereCriteria && this.__whereCriteria.id) {
            target = table.find(r => r.id === this.__whereCriteria.id);
          }
          if (!target && this.__whereCriteria) {
            const keys = Object.keys(this.__whereCriteria);
            target = table.find(r => keys.every(k => r[k] === this.__whereCriteria[k]));
          }
          if (target) {
            Object.assign(target, this.__updateData, { updated_at: now });
            return Promise.resolve([target]);
          }
        }
        return Promise.resolve([]);
      }),
      then: jest.fn(function (onFulfilled) { const rows = this.__evaluate(); return Promise.resolve(onFulfilled ? onFulfilled(rows) : rows); }),
      catch: jest.fn().mockReturnThis(),
      __evaluate: function () {
        const andOk = (row) => this.__filters.every(fn => fn(row));
        const orOk = (row) => (this.__orFilters.length === 0) || this.__orFilters.some(fn => fn(row));
        const grpOk = (row) => this.__groups.every(fn => fn(row));
        let rows = table.filter(row => andOk(row) && orOk(row) && grpOk(row));
        if (this.__orderBy) {
          const { col, dir } = this.__orderBy;
          rows = rows.slice().sort((a,b) => {
            const av = a[col]; const bv = b[col];
            if (av === bv) return 0;
            if (dir === 'desc') return av < bv ? 1 : -1;
            return av > bv ? 1 : -1;
          });
        }
        return rows;
      }
    };
    return builder;
  };

  const knexFactory = jest.fn((_config) => {
    // Return a callable function that acts as knex instance
    const callable = ((table) => {
      // Return a builder bound to this table
      return createBuilder(table);
    });

    // Attach common methods on the instance
    callable.raw = jest.fn().mockResolvedValue({ rows: [] });
    callable.transaction = jest.fn().mockImplementation(async (cb) => {
      const trx = {
        ...createBuilder('__trx__'),
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

  // Clear in-memory knex store between tests to avoid cross-test contamination
  if (typeof beforeEach === 'function') {
    beforeEach(() => {
      // @ts-ignore
      if (global.__KNEX_TEST_STORE__ && typeof global.__KNEX_TEST_STORE__.clear === 'function') {
        // @ts-ignore
        global.__KNEX_TEST_STORE__.clear();
      }
    });
  }

  afterAll(async () => {
    await closeDatabaseConnection();
  });
}

// Ensure the in-memory knex store is cleared before each test
if (typeof beforeEach === 'function') {
  beforeEach(() => {
    // @ts-ignore
    if (global.__KNEX_TEST_STORE__ && typeof global.__KNEX_TEST_STORE__.clear === 'function') {
      // @ts-ignore
      global.__KNEX_TEST_STORE__.clear();
    }
  });
}

// Use real monitoringService for unit tests (no global mock)

// Enable test bypass for auth and disable rate limiters globally for tests
process.env.TEST_BYPASS_AUTH = 'true';
process.env.TEST_DISABLE_RATE_LIMIT = 'false';

// Do not globally mock retailer service classes; tests will mock internals as needed

// Restore console after tests if needed
global.restoreConsole = () => {
  Object.assign(console, originalConsole);
};
