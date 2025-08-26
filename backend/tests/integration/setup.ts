import dotenv from 'dotenv';
import { Pool } from 'pg';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

let testDbPool: Pool;

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
});

// Clean up test database after each test
afterEach(async () => {
  if (testDbPool) {
    // Clean up test data
    await testDbPool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  }
});

// Close database connection
afterAll(async () => {
  if (testDbPool) {
    await testDbPool.end();
  }
});

// Export test database pool for use in tests
export { testDbPool };