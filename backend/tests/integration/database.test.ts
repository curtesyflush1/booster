import { db, initializeDatabase, closeDatabaseConnection, checkDatabaseHealth } from '../../src/config/database';

describe('Database Integration Tests', () => {
  beforeAll(async () => {
    // Initialize database connection for tests
    await initializeDatabase();
  });

  afterAll(async () => {
    // Close database connection after tests
    await closeDatabaseConnection();
  });

  describe('Database Connection', () => {
    it('should connect to the database successfully', async () => {
      const isHealthy = await checkDatabaseHealth();
      expect(isHealthy).toBe(true);
    });

    it('should execute raw queries', async () => {
      const result = await db.raw('SELECT 1 as test');
      expect(result.rows[0].test).toBe(1);
    });

    it('should handle database errors gracefully', async () => {
      try {
        await db.raw('SELECT * FROM non_existent_table');
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.code).toBe('42P01'); // PostgreSQL error code for undefined table
      }
    });
  });

  describe('Database Schema', () => {
    it('should have all required tables', async () => {
      const tables = await db.raw(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);

      const tableNames = tables.rows.map((row: any) => row.table_name);
      
      const expectedTables = [
        'users',
        'retailers',
        'product_categories',
        'products',
        'product_availability',
        'watches',
        'watch_packs',
        'user_watch_packs',
        'alerts',
        'alert_deliveries',
        'price_history',
        'user_sessions',
        'system_health',
        'knex_migrations',
        'knex_migrations_lock'
      ];

      expectedTables.forEach(tableName => {
        expect(tableNames).toContain(tableName);
      });
    });

    it('should have proper indexes on users table', async () => {
      const indexes = await db.raw(`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'users'
        ORDER BY indexname
      `);

      const indexNames = indexes.rows.map((row: any) => row.indexname);
      
      expect(indexNames).toContain('users_email_index');
      expect(indexNames).toContain('users_verification_token_index');
      expect(indexNames).toContain('users_reset_token_index');
    });

    it('should have proper foreign key constraints', async () => {
      const constraints = await db.raw(`
        SELECT 
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        ORDER BY tc.table_name, tc.constraint_name
      `);

      const constraintNames = constraints.rows.map((row: any) => row.constraint_name);
      
      // Check for some key foreign key constraints
      expect(constraintNames.some((name: string) => name.includes('watches_user_id'))).toBe(true);
      expect(constraintNames.some((name: string) => name.includes('watches_product_id'))).toBe(true);
      expect(constraintNames.some((name: string) => name.includes('alerts_user_id'))).toBe(true);
      expect(constraintNames.some((name: string) => name.includes('alerts_product_id'))).toBe(true);
    });
  });

  describe('Database Operations', () => {
    it('should support UUID generation', async () => {
      const result = await db.raw('SELECT gen_random_uuid() as uuid');
      const uuid = result.rows[0].uuid;
      
      expect(uuid).toBeDefined();
      expect(typeof uuid).toBe('string');
      expect(uuid.length).toBe(36); // Standard UUID length
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should support JSONB operations', async () => {
      // Test JSONB column operations
      const testData = { test: 'value', nested: { key: 'nested_value' } };
      
      const result = await db.raw(`
        SELECT ?::jsonb as test_json
      `, [JSON.stringify(testData)]);
      
      expect(result.rows[0].test_json).toEqual(testData);
    });

    it('should support timestamp operations', async () => {
      const result = await db.raw('SELECT NOW() as current_time');
      const timestamp = result.rows[0].current_time;
      
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should support array operations', async () => {
      const testArray = ['item1', 'item2', 'item3'];
      
      const result = await db.raw(`
        SELECT ?::text[] as test_array
      `, [testArray]);
      
      expect(result.rows[0].test_array).toEqual(testArray);
    });
  });

  describe('Transaction Support', () => {
    it('should support database transactions', async () => {
      const trx = await db.transaction();
      
      try {
        // This should work within a transaction
        await trx.raw('SELECT 1');
        await trx.commit();
      } catch (error) {
        await trx.rollback();
        throw error;
      }
    });

    it('should rollback transactions on error', async () => {
      const trx = await db.transaction();
      
      try {
        await trx.raw('SELECT 1');
        await trx.raw('SELECT * FROM non_existent_table'); // This should fail
        await trx.commit();
        fail('Should have thrown an error');
      } catch (error) {
        await trx.rollback();
        expect(error).toBeDefined();
      }
    });
  });

  describe('Connection Pooling', () => {
    it('should handle multiple concurrent connections', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => 
        db.raw('SELECT ? as connection_id', [i])
      );
      
      const results = await Promise.all(promises);
      
      results.forEach((result, index) => {
        expect(result.rows[0].connection_id).toBe(index);
      });
    });

    it('should maintain connection pool health', async () => {
      // Test that we can make multiple queries without issues
      for (let i = 0; i < 5; i++) {
        const result = await db.raw('SELECT ? as iteration', [i]);
        expect(result.rows[0].iteration).toBe(i);
      }
    });
  });

  describe('Migration System', () => {
    it('should track migration history', async () => {
      const migrations = await db('knex_migrations')
        .select('*')
        .orderBy('id');
      
      expect(migrations.length).toBeGreaterThan(0);
      
      // Check that our migrations are recorded
      const migrationNames = migrations.map(m => m.name);
      expect(migrationNames.some(name => name.includes('initial_schema'))).toBe(true);
      expect(migrationNames.some(name => name.includes('expand_core_schema'))).toBe(true);
    });

    it('should have proper migration lock table', async () => {
      const lockTable = await db('knex_migrations_lock').select('*');
      expect(Array.isArray(lockTable)).toBe(true);
    });
  });
});