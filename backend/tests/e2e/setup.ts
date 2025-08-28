import { Server } from 'http';
import app from '../../src/index';
import { db } from '../../src/config/database';

// E2E test utilities
export class E2ETestHelper {
  private static server: Server;
  private static baseURL: string;

  static async startServer(port: number = 0): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = app.listen(port, () => {
        const address = this.server.address();
        if (address && typeof address === 'object') {
          this.baseURL = `http://localhost:${address.port}`;
          resolve(this.baseURL);
        } else {
          reject(new Error('Failed to start server'));
        }
      });
    });
  }

  static async stopServer(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  static getBaseURL(): string {
    return this.baseURL;
  }

  // Database utilities for E2E tests
  static async cleanDatabase(): Promise<void> {
    try {
      // Clean up test data in reverse order of dependencies
      await db('alerts').del();
      await db('watches').del();
      await db('product_availability').del();
      await db('products').del();
      await db('users').del();
      await db('retailers').del();
    } catch (error) {
      console.warn('Database cleanup failed:', error);
    }
  }

  static async seedTestData(): Promise<{
    users: any[];
    products: any[];
    retailers: any[];
  }> {
    // Seed retailers
    const retailers = await db('retailers').insert([
      {
        id: 'retailer-1',
        name: 'Best Buy',
        slug: 'best-buy',
        api_type: 'official',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 'retailer-2',
        name: 'Walmart',
        slug: 'walmart',
        api_type: 'affiliate',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]).returning('*');

    // Seed products
    const products = await db('products').insert([
      {
        id: 'product-1',
        name: 'Pokemon Booster Pack - Scarlet & Violet',
        slug: 'pokemon-booster-pack-scarlet-violet',
        sku: 'PKM-SV-001',
        upc: '123456789012',
        msrp: 4.99,
        category_id: 'booster-packs',
        is_active: true,
        popularity_score: 85,
        created_at: new Date(),
        updated_at: new Date(),
        metadata: {}
      },
      {
        id: 'product-2',
        name: 'Pokemon Elite Trainer Box - Paldea Evolved',
        slug: 'pokemon-etb-paldea-evolved',
        sku: 'PKM-PE-ETB',
        upc: '123456789013',
        msrp: 49.99,
        category_id: 'elite-trainer-boxes',
        is_active: true,
        popularity_score: 92,
        created_at: new Date(),
        updated_at: new Date(),
        metadata: {}
      }
    ]).returning('*');

    // Seed users
    const users = await db('users').insert([
      {
        id: 'user-1',
        email: 'test@example.com',
        password_hash: '$2b$10$example.hash.here',
        subscription_tier: 'free',
        role: 'user',
        email_verified: true,
        failed_login_attempts: 0,
        admin_permissions: JSON.stringify([]),
        shipping_addresses: JSON.stringify([]),
        payment_methods: JSON.stringify([]),
        retailer_credentials: JSON.stringify({}),
        notification_settings: JSON.stringify({
          web_push: true,
          email: true,
          sms: false,
          discord: false
        }),
        quiet_hours: JSON.stringify({
          enabled: false,
          start_time: '22:00',
          end_time: '08:00',
          timezone: 'UTC',
          days: []
        }),
        timezone: 'UTC',
        preferences: JSON.stringify({}),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 'user-2',
        email: 'pro@example.com',
        password_hash: '$2b$10$example.hash.here',
        subscription_tier: 'pro',
        role: 'user',
        email_verified: true,
        failed_login_attempts: 0,
        admin_permissions: JSON.stringify([]),
        shipping_addresses: JSON.stringify([]),
        payment_methods: JSON.stringify([]),
        retailer_credentials: JSON.stringify({}),
        notification_settings: JSON.stringify({
          web_push: true,
          email: true,
          sms: true,
          discord: true
        }),
        quiet_hours: JSON.stringify({
          enabled: false,
          start_time: '22:00',
          end_time: '08:00',
          timezone: 'UTC',
          days: []
        }),
        timezone: 'UTC',
        preferences: JSON.stringify({}),
        created_at: new Date(),
        updated_at: new Date()
      }
    ]).returning('*');

    return { users, products, retailers };
  }

  // Wait for async operations to complete
  static async waitFor(
    condition: () => Promise<boolean>,
    timeout: number = 10000,
    interval: number = 100
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }

  // Simulate user interactions
  static async simulateUserJourney(steps: Array<{
    action: string;
    endpoint: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    data?: any;
    headers?: Record<string, string>;
    expectedStatus?: number;
  }>): Promise<any[]> {
    const results = [];
    
    for (const step of steps) {
      const result = await this.makeRequest(
        step.method,
        step.endpoint,
        step.data,
        step.headers
      );
      
      if (step.expectedStatus && result.status !== step.expectedStatus) {
        throw new Error(`Step "${step.action}" failed: expected ${step.expectedStatus}, got ${result.status}`);
      }
      
      results.push(result);
    }
    
    return results;
  }

  private static async makeRequest(
    method: string,
    endpoint: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<any> {
    const fetch = require('node-fetch');
    const url = `${this.baseURL}${endpoint}`;
    
    const options: any = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(url, options);
    const body = await response.json().catch(() => ({}));
    
    return {
      status: response.status,
      headers: response.headers,
      body
    };
  }
}

// Global setup and teardown
beforeAll(async () => {
  await E2ETestHelper.startServer();
  await E2ETestHelper.cleanDatabase();
}, 30000);

afterAll(async () => {
  await E2ETestHelper.cleanDatabase();
  await E2ETestHelper.stopServer();
}, 30000);

beforeEach(async () => {
  await E2ETestHelper.cleanDatabase();
});

afterEach(async () => {
  // Clean up after each test
});