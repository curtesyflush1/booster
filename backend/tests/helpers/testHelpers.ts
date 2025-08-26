import { MockTimeProvider } from '../../src/utils/timeProvider';

/**
 * Test helper utilities for consistent testing patterns
 */

// UUID generation for tests
export const generateTestUUID = (suffix = '0000'): string => 
  `550e8400-e29b-41d4-a716-44665544${suffix}`;

// Time mocking helper
export class TestTimeHelper {
  private mockTimeProvider: MockTimeProvider;
  private originalConsoleWarn: typeof console.warn;

  constructor(initialTime: Date) {
    this.mockTimeProvider = new MockTimeProvider(initialTime);
    this.originalConsoleWarn = console.warn;
  }

  setTime(time: Date): void {
    this.mockTimeProvider.setTime(time);
  }

  getProvider(): MockTimeProvider {
    return this.mockTimeProvider;
  }

  suppressWarnings(): void {
    console.warn = jest.fn();
  }

  restoreWarnings(): void {
    console.warn = this.originalConsoleWarn;
  }

  cleanup(): void {
    this.restoreWarnings();
  }
}

// Mock response builder
export class MockResponseBuilder {
  private data: any = {};
  private status = 200;

  withData(data: any): this {
    this.data = data;
    return this;
  }

  withStatus(status: number): this {
    this.status = status;
    return this;
  }

  withPagination(total: number, page = 1, limit = 10): this {
    this.data = {
      ...this.data,
      pagination: { total, page, limit }
    };
    return this;
  }

  build() {
    return {
      status: this.status,
      body: this.data
    };
  }
}

// Database mock helpers
export const createMockUser = (overrides: Partial<any> = {}) => ({
  id: generateTestUUID('user'),
  email: 'test@example.com',
  password_hash: 'hashed-password',
  subscription_tier: 'free',
  email_verified: true,
  failed_login_attempts: 0,
  shipping_addresses: [],
  payment_methods: [],
  retailer_credentials: {},
  notification_settings: {
    web_push: true,
    email: true,
    sms: false,
    discord: false
  },
  quiet_hours: {
    enabled: false,
    start_time: '22:00',
    end_time: '08:00',
    timezone: 'UTC',
    days: []
  },
  timezone: 'UTC',
  preferences: {},
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides
});

export const createMockProduct = (overrides: Partial<any> = {}) => {
  const baseProduct = {
    id: generateTestUUID('prod'),
    name: 'Test Product',
    slug: 'test-product',
    upc: '123456789012',
    sku: undefined, // Use undefined instead of null for optional fields
    msrp: undefined,
    set_name: undefined,
    series: undefined,
    category_id: undefined,
    image_url: undefined,
    description: undefined,
    release_date: undefined,
    is_active: true,
    popularity_score: 50,
    created_at: new Date(),
    updated_at: new Date(),
    metadata: {},
    availability: [],
    ...overrides
  };

  // Ensure slug matches name if name is overridden but slug isn't
  if (overrides.name && !overrides.slug) {
    baseProduct.slug = overrides.name.toLowerCase().replace(/\s+/g, '-');
  }

  return baseProduct;
};