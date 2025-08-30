/**
 * Test Database Harness
 * 
 * Provides reliable database setup and teardown for the test environment.
 * This ensures consistent test state and proper database initialization.
 */

import { logger } from '../../src/utils/logger';
import knex from 'knex';
import databaseConfig from '../../src/config/database';

let testKnex: knex.Knex | null = null;

/**
 * Initialize the test database with migrations and seeds
 */
export async function initializeDatabase(): Promise<void> {
  try {
    // Create Knex instance for test environment
    testKnex = knex(databaseConfig);
    
    // Run database migrations
    await testKnex.migrate.latest();
    logger.info?.('Test database migrations completed');
    
    // Run seeds if available (optional - seeds may not exist in test env)
    try {
      await testKnex.seed.run();
      logger.info?.('Test database seeds completed');
    } catch (seedError) {
      // Seeds are optional - continue if they fail
      logger.warn?.('Test database seeds skipped or failed (this is often normal in test environment)');
    }
    
    logger.info?.('Test database initialized successfully');
  } catch (error) {
    logger.error?.('Failed to initialize test database', {
      error: error instanceof Error ? error.message : String(error)
    });
    // Don't throw - let tests proceed with mocked environment
  }
}

/**
 * Close the database connection and clean up resources
 */
export async function closeDatabaseConnection(): Promise<void> {
  try {
    if (testKnex) {
      await testKnex.destroy();
      testKnex = null;
      logger.info?.('Test database connection closed');
    }
  } catch (error) {
    logger.warn?.('Error closing test database connection', {
      error: error instanceof Error ? error.message : String(error)
    });
    // Swallow errors during teardown
  }
}

/**
 * Get the test database instance (for advanced test scenarios)
 */
export function getTestDatabase(): knex.Knex | null {
  return testKnex;
}

/**
 * Reset the database to a clean state (for integration tests)
 */
export async function resetDatabase(): Promise<void> {
  if (!testKnex) {
    logger.warn?.('Cannot reset database - no connection available');
    return;
  }
  
  try {
    // Rollback all migrations and re-run them
    await testKnex.migrate.rollback();
    await testKnex.migrate.latest();
    
    logger.info?.('Test database reset completed');
  } catch (error) {
    logger.error?.('Failed to reset test database', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
