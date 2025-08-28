import knex, { Knex } from 'knex';
import { logger } from '../utils/logger';

// Database configuration interface
interface IDatabaseConfig {
  client: string;
  connection: string | {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  pool: {
    min: number;
    max: number;
    acquireTimeoutMillis: number;
    createTimeoutMillis: number;
    destroyTimeoutMillis: number;
    idleTimeoutMillis: number;
    reapIntervalMillis: number;
    createRetryIntervalMillis: number;
  };
  migrations: {
    directory: string;
    tableName: string;
  };
  seeds: {
    directory: string;
  };
}

// Get database configuration based on environment
function getDatabaseConfig(): IDatabaseConfig {
  const env = process.env.NODE_ENV || 'development';
  
  // Use DATABASE_URL if available, otherwise fall back to individual env vars
  const databaseUrl = env === 'test' ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;
  
  const baseConfig: IDatabaseConfig = {
    client: 'postgresql',
    connection: databaseUrl || {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || `boosterbeacon_${env}`,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password'
    },
    pool: {
      min: 2,
      max: 10,
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200
    },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: './seeds'
    }
  };

  // Environment-specific overrides
  if (env === 'test') {
    // For test environment, override connection if using object format
    if (!databaseUrl && typeof baseConfig.connection === 'object') {
      baseConfig.connection.database = process.env.DB_NAME_TEST || 'boosterbeacon_test';
    }
    baseConfig.pool.min = 1;
    baseConfig.pool.max = 5;
  } else if (env === 'production') {
    baseConfig.pool.min = 5;
    baseConfig.pool.max = 20;
  }

  return baseConfig;
}

// Create and configure the database connection
const config = getDatabaseConfig();
export const db: Knex = knex(config);

// Database connection health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await db.raw('SELECT 1');
    return true;
  } catch (error) {
    logger.error('Database health check failed:', error);
    return false;
  }
}

// Initialize database connection with retry logic
export async function initializeDatabase(maxRetries: number = 5): Promise<void> {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      // Test the connection
      await db.raw('SELECT 1');
      logger.info('Database connection established successfully');
      
      // Run pending migrations in non-test environments
      if (process.env.NODE_ENV !== 'test') {
        await db.migrate.latest();
        logger.info('Database migrations completed');
      }
      
      return;
    } catch (error) {
      retries++;
      logger.error(`Database connection attempt ${retries} failed:`, error);
      
      if (retries >= maxRetries) {
        throw new Error(`Failed to connect to database after ${maxRetries} attempts`);
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
    }
  }
}

// Graceful database shutdown
export async function closeDatabaseConnection(): Promise<void> {
  try {
    await db.destroy();
    logger.info('Database connection closed successfully');
  } catch (error) {
    logger.error('Error closing database connection:', error);
    throw error;
  }
}

// Transaction helper
export async function withTransaction<T>(
  callback: (trx: Knex.Transaction) => Promise<T>
): Promise<T> {
  const trx = await db.transaction();
  
  try {
    const result = await callback(trx);
    await trx.commit();
    return result;
  } catch (error) {
    await trx.rollback();
    throw error;
  }
}

// Query builder helpers
export const queryBuilder = {
  // Get paginated results
  paginate: <T>(
    query: Knex.QueryBuilder,
    page: number = 1,
    limit: number = 20
  ) => {
    const offset = (page - 1) * limit;
    return query.offset(offset).limit(limit);
  },

  // Add soft delete support
  whereNotDeleted: (query: Knex.QueryBuilder, column: string = 'deleted_at') => {
    return query.whereNull(column);
  },

  // Add search functionality
  search: (
    query: Knex.QueryBuilder,
    searchTerm: string,
    columns: string[]
  ) => {
    if (!searchTerm) return query;
    
    return query.where(function() {
      columns.forEach((column, index) => {
        const method = index === 0 ? 'where' : 'orWhere';
        this[method](column, 'ILIKE', `%${searchTerm}%`);
      });
    });
  }
};

// Database error handling
export function handleDatabaseError(error: any): IDatabaseError {
  const dbError: IDatabaseError = {
    code: error.code || 'UNKNOWN_ERROR',
    message: error.message || 'An unknown database error occurred'
  };

  // PostgreSQL specific error handling
  switch (error.code) {
    case '23505': // Unique violation
      dbError.code = 'DUPLICATE_ENTRY';
      dbError.message = 'A record with this value already exists';
      dbError.constraint = error.constraint;
      break;
    
    case '23503': // Foreign key violation
      dbError.code = 'FOREIGN_KEY_VIOLATION';
      dbError.message = 'Referenced record does not exist';
      dbError.constraint = error.constraint;
      break;
    
    case '23502': // Not null violation
      dbError.code = 'REQUIRED_FIELD_MISSING';
      dbError.message = 'Required field is missing';
      dbError.column = error.column;
      break;
    
    case '42P01': // Undefined table
      dbError.code = 'TABLE_NOT_FOUND';
      dbError.message = 'Database table does not exist';
      break;
    
    case '42703': // Undefined column
      dbError.code = 'COLUMN_NOT_FOUND';
      dbError.message = 'Database column does not exist';
      break;
    
    case 'ECONNREFUSED':
      dbError.code = 'CONNECTION_REFUSED';
      dbError.message = 'Unable to connect to database';
      break;
    
    case 'ENOTFOUND':
      dbError.code = 'HOST_NOT_FOUND';
      dbError.message = 'Database host not found';
      break;
  }

  return dbError;
}

// Export types for use in other modules
export type { IDatabaseConfig, IDatabaseError };
export type { Knex } from 'knex';

// Import database error type
import { IDatabaseError } from '../types/database';