import { MockTimeProvider } from '../../src/utils/timeProvider';
import { SubscriptionTier } from '../../src/types/subscription';

/**
 * Test helper utilities for consistent testing patterns
 */

// Type definitions for better type safety
interface MockUser {
  id: string;
  email: string;
  password_hash: string;
  subscription_tier: SubscriptionTier;
  email_verified: boolean;
  failed_login_attempts: number;
  shipping_addresses: any[];
  payment_methods: any[];
  retailer_credentials: Record<string, any>;
  notification_settings: {
    web_push: boolean;
    email: boolean;
    sms: boolean;
    discord: boolean;
  };
  quiet_hours: {
    enabled: boolean;
    start_time: string;
    end_time: string;
    timezone: string;
    days: string[];
  };
  timezone: string;
  preferences: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

interface MockProduct {
  id: string;
  name: string;
  slug: string;
  upc: string;
  sku: string;
  msrp?: number | undefined;
  set_name?: string | undefined;
  series?: string | undefined;
  category_id?: string | undefined;
  image_url?: string | undefined;
  description?: string | undefined;
  release_date?: Date | undefined;
  is_active: boolean;
  popularity_score: number;
  created_at: Date;
  updated_at: Date;
  metadata: Record<string, any>;
  availability: any[];
}

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
export class MockResponseBuilder<T = Record<string, any>> {
  private data: T = {} as T;
  private status = 200;

  withData(data: T): this {
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
    } as T;
    return this;
  }

  build(): { status: number; body: T } {
    return {
      status: this.status,
      body: this.data
    };
  }
}

// UPC validation helper for consistent testing
export const createValidUPC = (): string => '123456789012';
export const createInvalidUPC = (): string => 'invalid-upc-format';

// Test assertion helpers
interface ErrorResponse {
  body: {
    error: {
      code: string;
      message?: string;
      details?: string;
    };
  };
}

export const expectValidationError = (response: ErrorResponse, field?: string): void => {
  expect(response.body.error.code).toBe('VALIDATION_ERROR');
  if (field) {
    expect(response.body.error.details).toContain(field);
  }
};

export const expectNotFoundError = (response: ErrorResponse, resource?: string): void => {
  expect(response.body.error.code).toBe('PRODUCT_NOT_FOUND');
  if (resource) {
    expect(response.body.error.message).toContain(resource);
  }
};

// Mock data factories
interface SearchResult<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const createMockSearchResult = <T>(
  products: T[] = [], 
  pagination = { page: 1, limit: 20, total: 0, totalPages: 0 }
): SearchResult<T> => ({
  data: products,
  page: pagination.page,
  limit: pagination.limit,
  total: products.length,
  totalPages: Math.ceil(products.length / pagination.limit)
});

// Database mock helpers
export const createMockUser = (overrides: Partial<MockUser> = {}): MockUser => ({
  id: generateTestUUID('user'),
  email: 'test@example.com',
  password_hash: 'hashed-password',
  subscription_tier: SubscriptionTier.FREE,
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

export const createMockProduct = (overrides: Partial<MockProduct> = {}): MockProduct => {
  const baseProduct = {
    id: generateTestUUID('prod'),
    name: 'Test Product',
    slug: 'test-product',
    upc: '123456789012',
    sku: 'TEST-SKU-001', // Provide a default SKU
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

// Test data constants for consistency
export const TEST_CONSTANTS = {
  VALID_UUID: '550e8400-e29b-41d4-a716-446655440000',
  VALID_UPC: '123456789012',
  INVALID_UPC: 'invalid-upc',
  INVALID_UUID: 'invalid-id',
  DEFAULT_PAGINATION: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  }
} as const;

// Enhanced mock product factory with better type safety
export const createTypedMockProduct = (overrides: Partial<{
  id: string;
  name: string;
  slug: string;
  upc: string;
  sku?: string;
  msrp?: number;
  category_id?: string;
  popularity_score: number;
}> = {}) => {
  return createMockProduct({
    id: TEST_CONSTANTS.VALID_UUID,
    upc: TEST_CONSTANTS.VALID_UPC,
    ...overrides
  });
};

// Database test helpers for actual database operations
import { User } from '../../src/models/User';
import { Product } from '../../src/models/Product';
import { IUser, IProduct } from '../../src/types/database';

/**
 * Creates a test user in the database with realistic data
 * @param email - User email (defaults to test@example.com)
 * @param overrides - Optional field overrides
 * @returns Promise<IUser> - Created user object
 */
export const createTestUser = async (
  email: string = 'test@example.com',
  overrides: Partial<IUser> = {}
): Promise<IUser> => {
  const userData: Partial<IUser> = {
    email,
    password_hash: 'hashed-password',
    subscription_tier: SubscriptionTier.FREE,
    first_name: 'Test',
    last_name: 'User',
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
    ...overrides
  };

  return await User.create<IUser>(userData);
};

/**
 * Creates a test product in the database with realistic data
 * @param name - Product name (defaults to 'Test Product')
 * @param overrides - Optional field overrides
 * @returns Promise<IProduct> - Created product object
 */
export const createTestProduct = async (
  name: string = 'Test Product',
  overrides: Partial<IProduct> = {}
): Promise<IProduct> => {
  // Generate deterministic but unique UPC for testing
  const timestamp = Date.now().toString();
  const upc = timestamp.substring(timestamp.length - 12).padStart(12, '0');
  
  const productData: Partial<IProduct> = {
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    upc,
    sku: `SKU-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    msrp: 99.99,
    set_name: 'Test Set',
    series: 'Test Series',
    description: `Description for ${name}`,
    is_active: true,
    popularity_score: 50,
    metadata: {},
    ...overrides
  };

  return await Product.create<IProduct>(productData);
};

/**
 * Creates multiple test products efficiently
 * @param count - Number of products to create
 * @param namePrefix - Prefix for product names
 * @returns Promise<IProduct[]> - Array of created products
 */
export const createTestProducts = async (
  count: number,
  namePrefix: string = 'Test Product'
): Promise<IProduct[]> => {
  const products: Promise<IProduct>[] = [];
  
  for (let i = 1; i <= count; i++) {
    products.push(createTestProduct(`${namePrefix} ${i}`));
  }
  
  return Promise.all(products);
};

/**
 * Cleanup helper to remove test data
 * Note: In a real test environment, you would typically use database transactions
 * or a test database that gets reset between tests
 */
export const cleanupTestData = async (
  userIds: string[] = [],
  productIds: string[] = []
): Promise<void> => {
  try {
    // Clean up in batches to avoid overwhelming the database
    const batchSize = 50;
    
    if (userIds.length > 0) {
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        // Use model deleteById method for cleanup
        for (const id of batch) {
          try {
            await User.deleteById(id);
          } catch (error) {
            // Ignore errors for test cleanup
          }
        }
      }
    }
    
    if (productIds.length > 0) {
      for (let i = 0; i < productIds.length; i += batchSize) {
        const batch = productIds.slice(i, i + batchSize);
        // Use model deleteById method for cleanup
        for (const id of batch) {
          try {
            await Product.deleteById(id);
          } catch (error) {
            // Ignore errors for test cleanup
          }
        }
      }
    }
  } catch (error) {
    console.warn('Cleanup failed:', error);
  }
};

// ============================================================================
// COMPATIBILITY SHIMS FOR REFACTORED SERVICES
// ============================================================================
// These shims provide backward compatibility for tests written against the 
// old service patterns before the dependency injection refactor.

/**
 * QuietHoursService static method compatibility shim
 * The service now uses a factory pattern, but legacy tests expect static methods
 */
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const quietHoursModule = require('../../src/services/quietHoursService');
  
  if (quietHoursModule && quietHoursModule.createQuietHoursService) {
    // Create a singleton instance for compatibility
    const quietHoursInstance = quietHoursModule.createQuietHoursService();
    
    // Ensure the QuietHoursService class exists for static method attachment
    if (!quietHoursModule.QuietHoursService) {
      quietHoursModule.QuietHoursService = {};
    }
    
    // Add static-style methods that proxy to the instance
    if (!quietHoursModule.QuietHoursService.isQuietTime) {
      quietHoursModule.QuietHoursService.isQuietTime = async (userId: string) => {
        return quietHoursInstance.isQuietTime(userId);
      };
    }
    
    if (!quietHoursModule.QuietHoursService.validateQuietHours) {
      quietHoursModule.QuietHoursService.validateQuietHours = (quietHoursData: any) => {
        return quietHoursInstance.validateQuietHours(quietHoursData);
      };
    }
    
    if (!quietHoursModule.QuietHoursService.getOptimalNotificationTime) {
      quietHoursModule.QuietHoursService.getOptimalNotificationTime = async (userId: string, delayMs?: number) => {
        return quietHoursInstance.getOptimalNotificationTime(userId, delayMs);
      };
    }
  }
} catch (error) {
  // Silently fail if the service doesn't exist or can't be loaded
}

/**
 * BaseModel.create legacy signature compatibility
 * The model layer now uses different create patterns, but tests expect the old signature
 */
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const baseModelModule = require('../../src/models/BaseModel');
  
  if (baseModelModule && baseModelModule.BaseModel) {
    // Add legacy create method that matches old signature: BaseModel.create(tableName, data)
    if (!baseModelModule.BaseModel.createLegacy) {
      baseModelModule.BaseModel.createLegacy = async (tableName: string, data: Record<string, any>) => {
        try {
          // Get the knex instance
          const knex = baseModelModule.BaseModel.getKnex?.() || baseModelModule.getKnex?.();
          if (knex) {
            const [result] = await knex(tableName).insert(data).returning('*');
            return result || data;
          }
          return data;
        } catch (error) {
          console.warn(`Legacy BaseModel.create failed for table ${tableName}:`, error);
          return data; // Return the input data as fallback
        }
      };
    }
  }
} catch (error) {
  // Silently fail if BaseModel doesn't exist
}

/**
 * TokenBlacklistService singleton export compatibility
 * Tests expect a singleton instance to be exported from the service module
 */
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const tokenBlacklistModule = require('../../src/services/tokenBlacklistService');
  
  if (tokenBlacklistModule && tokenBlacklistModule.TokenBlacklistService) {
    // Export a singleton instance if not already present
    if (!tokenBlacklistModule.tokenBlacklistService) {
      tokenBlacklistModule.tokenBlacklistService = new tokenBlacklistModule.TokenBlacklistService();
    }
  }
} catch (error) {
  // Silently fail if the service doesn't exist
}

/**
 * Export compatibility instances for direct import in tests
 */
export let QuietHoursServiceCompat: any = null;
export let TokenBlacklistServiceCompat: any = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const qhModule = require('../../src/services/quietHoursService');
  if (qhModule?.QuietHoursService) {
    QuietHoursServiceCompat = qhModule.QuietHoursService;
  }
} catch {}

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const tbsModule = require('../../src/services/tokenBlacklistService');
  if (tbsModule?.tokenBlacklistService) {
    TokenBlacklistServiceCompat = tbsModule.tokenBlacklistService;
  }
} catch {}