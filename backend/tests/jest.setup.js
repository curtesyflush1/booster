/**
 * Jest setup file for test environment configuration
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'sqlite::memory:';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.REDIS_URL = 'redis://localhost:6379';

// Mock the database configuration to use SQLite in memory
jest.mock('../src/config/database', () => ({
  default: {
    client: 'sqlite3',
    connection: ':memory:',
    useNullAsDefault: true,
    pool: {
      min: 0,
      max: 1
    },
    migrations: {
      directory: './migrations'
    },
    seeds: {
      directory: './seeds'
    }
  }
}));

// Global test timeout
jest.setTimeout(30000);

// Suppress console output in tests
console.error = jest.fn();
console.warn = jest.fn();
console.log = jest.fn();