/**
 * Database configuration constants
 */
export const DATABASE_CONSTANTS = {
  POOL: {
    MIN_CONNECTIONS: 2,
    MAX_CONNECTIONS: 10,
    MIN_CONNECTIONS_TEST: 1,
    MAX_CONNECTIONS_TEST: 5,
    MIN_CONNECTIONS_PROD: 5,
    MAX_CONNECTIONS_PROD: 20,
  },
  TIMEOUTS: {
    ACQUIRE: 60000,
    CREATE: 30000,
    DESTROY: 5000,
    IDLE: 300000,
    REAP_INTERVAL: 1000,
    CREATE_RETRY_INTERVAL: 200,
  },
  RETRY: {
    MAX_ATTEMPTS: 3,
    BASE_DELAY: 1000,
  }
} as const;

export type DatabaseConstants = typeof DATABASE_CONSTANTS;