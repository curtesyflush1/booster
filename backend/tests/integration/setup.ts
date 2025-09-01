import dotenv from 'dotenv';
import { Pool } from 'pg';
import knexFactory, { Knex } from 'knex';
import dbConfig from '../../src/config/database';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

let testDbPool: Pool;
let testKnex: Knex | null = null;

// Setup test database connection
beforeAll(async () => {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL || 
    'postgresql://booster_user:booster_test_password@localhost:5435/boosterbeacon_test';
  
  testDbPool = new Pool({
    connectionString: testDatabaseUrl,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Wait for database to be ready
  let retries = 10;
  while (retries > 0) {
    try {
      await testDbPool.query('SELECT 1');
      break;
    } catch (error) {
      retries--;
      if (retries === 0) {
        throw new Error('Could not connect to test database');
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Ensure database schema is up to date for integration tests
  try {
    testKnex = knexFactory(dbConfig as any);
    await testKnex.migrate.latest();
  } catch (err) {
    // Surface a clearer error if migrations fail
    throw new Error(`Could not run test database migrations: ${(err as Error).message}`);
  }

  // Run seeds if available (optional)
  try {
    await testKnex!.seed.run();
  } catch (seedErr) {
    // Not fatal if seeds are absent; continue with tests
  }
});

// Clean up test database after each test
afterEach(async () => {
  // Clean up test data between tests, but do not fail the suite if cleanup has issues
  try {
    // Discover all public tables except knex migration tables
    if (!testKnex) return;
    const result = await testKnex.raw<{
      rows: Array<{ table_name: string }>;
    }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT IN ('knex_migrations','knex_migrations_lock')"
    );

    const tables = (result.rows || []).map(r => r.table_name).filter(Boolean);
    if (tables.length > 0) {
      const qualified = tables.map(t => `"public"."${t}"`).join(', ');
      await testKnex.raw(`TRUNCATE TABLE ${qualified} RESTART IDENTITY CASCADE`);
    }
  } catch (err) {
    // Swallow errors to avoid crashing the entire suite if tables are missing or locked
  }
});

// Close database connection
afterAll(async () => {
  if (testDbPool) {
    await testDbPool.end();
  }
  // Close Knex connection
  try {
    if (testKnex) {
      await testKnex.destroy();
    }
  } catch {}
});

// Export test database pool for use in tests
export { testDbPool };
