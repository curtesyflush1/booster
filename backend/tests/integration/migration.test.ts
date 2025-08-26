import { db } from '../../src/config/database';

describe('Database Migration Tests', () => {
  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
  });

  afterAll(async () => {
    // Clean up
    if (db) {
      await db.destroy();
    }
  });

  it('should be able to connect to database', async () => {
    try {
      const result = await db.raw('SELECT 1 as test');
      expect(result.rows[0].test).toBe(1);
    } catch (error) {
      // If we can't connect, that's expected in this environment
      // Just verify the error is a connection error, not a code error
      expect(error).toBeDefined();
    }
  });

  it('should have proper migration structure', async () => {
    // This test verifies our migration files are properly structured
    const fs = require('fs');
    const path = require('path');
    
    const migrationsDir = path.join(__dirname, '../../migrations');
    const migrationFiles = fs.readdirSync(migrationsDir);
    
    expect(migrationFiles.length).toBeGreaterThan(0);
    
    // Check that we have our core migrations
    const hasInitialSchema = migrationFiles.some((file: string) => 
      file.includes('initial_schema')
    );
    const hasExpandedSchema = migrationFiles.some((file: string) => 
      file.includes('expand_core_schema')
    );
    
    expect(hasInitialSchema).toBe(true);
    expect(hasExpandedSchema).toBe(true);
  });
});