import { Pool } from 'pg';
import { testDbPool } from './setup';

describe('Database Integration Tests', () => {
  describe('Database Connection', () => {
    it('should connect to test database successfully', async () => {
      const result = await testDbPool.query('SELECT 1 as test');
      expect(result.rows[0].test).toBe(1);
    });

    it('should have required extensions installed', async () => {
      const result = await testDbPool.query(`
        SELECT extname FROM pg_extension 
        WHERE extname IN ('uuid-ossp', 'pg_trgm')
        ORDER BY extname
      `);
      
      const extensions = result.rows.map(row => row.extname);
      expect(extensions).toContain('uuid-ossp');
      expect(extensions).toContain('pg_trgm');
    });
  });

  describe('Users Table', () => {
    it('should have users table with correct structure', async () => {
      const result = await testDbPool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'users'
        ORDER BY ordinal_position
      `);

      const columns = result.rows.reduce((acc, row) => {
        acc[row.column_name] = {
          type: row.data_type,
          nullable: row.is_nullable === 'YES'
        };
        return acc;
      }, {});

      expect(columns.id).toEqual({ type: 'uuid', nullable: false });
      expect(columns.email).toEqual({ type: 'character varying', nullable: false });
      expect(columns.password_hash).toEqual({ type: 'character varying', nullable: false });
      expect(columns.subscription_tier).toEqual({ type: 'character varying', nullable: true });
      expect(columns.created_at).toEqual({ type: 'timestamp with time zone', nullable: true });
      expect(columns.updated_at).toEqual({ type: 'timestamp with time zone', nullable: true });
    });

    it('should enforce unique email constraint', async () => {
      const email = 'test@example.com';
      const passwordHash = '$2b$12$test.hash.here';

      // Insert first user
      await testDbPool.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2)',
        [email, passwordHash]
      );

      // Try to insert duplicate email
      await expect(
        testDbPool.query(
          'INSERT INTO users (email, password_hash) VALUES ($1, $2)',
          [email, passwordHash]
        )
      ).rejects.toThrow();
    });

    it('should generate UUID for new users', async () => {
      const result = await testDbPool.query(`
        INSERT INTO users (email, password_hash) 
        VALUES ('uuid-test@example.com', '$2b$12$test.hash.here')
        RETURNING id
      `);

      const userId = result.rows[0].id;
      expect(userId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should set default subscription tier to free', async () => {
      const result = await testDbPool.query(`
        INSERT INTO users (email, password_hash) 
        VALUES ('default-tier@example.com', '$2b$12$test.hash.here')
        RETURNING subscription_tier
      `);

      expect(result.rows[0].subscription_tier).toBe('free');
    });

    it('should set timestamps on insert', async () => {
      const result = await testDbPool.query(`
        INSERT INTO users (email, password_hash) 
        VALUES ('timestamp-test@example.com', '$2b$12$test.hash.here')
        RETURNING created_at, updated_at
      `);

      const { created_at, updated_at } = result.rows[0];
      expect(new Date(created_at)).toBeInstanceOf(Date);
      expect(new Date(updated_at)).toBeInstanceOf(Date);
      expect(created_at).toEqual(updated_at); // Should be same on insert
    });
  });

  describe('Database Performance', () => {
    it('should have index on users email column', async () => {
      const result = await testDbPool.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'users' AND indexdef LIKE '%email%'
      `);

      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows[0].indexname).toMatch(/email/);
    });

    it('should perform fast email lookups', async () => {
      // Insert test data
      const emails = [];
      for (let i = 0; i < 100; i++) {
        emails.push(`user${i}@example.com`);
      }

      const insertPromises = emails.map(email =>
        testDbPool.query(
          'INSERT INTO users (email, password_hash) VALUES ($1, $2)',
          [email, '$2b$12$test.hash.here']
        )
      );
      await Promise.all(insertPromises);

      // Test query performance
      const startTime = Date.now();
      await testDbPool.query('SELECT * FROM users WHERE email = $1', ['user50@example.com']);
      const queryTime = Date.now() - startTime;

      // Query should be fast (under 10ms)
      expect(queryTime).toBeLessThan(10);
    });
  });
});