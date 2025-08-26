import { User } from '../../src/models/User';
import { Product } from '../../src/models/Product';
import { Watch } from '../../src/models/Watch';
import { Alert } from '../../src/models/Alert';

// Mock the database connection for unit tests
jest.mock('../../src/config/database', () => ({
  db: {
    transaction: jest.fn(),
    raw: jest.fn(),
    migrate: {
      latest: jest.fn()
    }
  },
  handleDatabaseError: jest.fn((error) => error),
  initializeDatabase: jest.fn(),
  closeDatabaseConnection: jest.fn()
}));

// Mock the logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('Model Validation Tests', () => {
  describe('User Model Validation', () => {
    it('should validate email correctly', () => {
      const user = new User();
      
      // Test required email
      let errors = user.validate({ email: '' });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.field).toBe('email');
      
      // Test invalid email format
      errors = user.validate({ email: 'invalid-email' });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.field).toBe('email');
      
      // Test valid email
      errors = user.validate({ email: 'test@example.com' });
      const emailErrors = errors.filter(e => e.field === 'email');
      expect(emailErrors).toHaveLength(0);
    });

    it('should sanitize user data correctly', () => {
      const user = new User();
      const sanitized = user.sanitize({
        email: '  TEST@EXAMPLE.COM  ',
        first_name: '  John  ',
        last_name: '  Doe  '
      });
      
      expect(sanitized.email).toBe('test@example.com');
      expect(sanitized.first_name).toBe('John');
      expect(sanitized.last_name).toBe('Doe');
      expect(Array.isArray(sanitized.shipping_addresses)).toBe(true);
      expect(typeof sanitized.notification_settings).toBe('object');
    });
  });

  describe('Product Model Validation', () => {
    it('should validate product name and slug', () => {
      const product = new Product();
      
      // Test required name
      let errors = product.validate({ name: '' });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.field === 'name')).toBe(true);
      
      // Test required slug
      errors = product.validate({ name: 'Test Product', slug: '' });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.field === 'slug')).toBe(true);
      
      // Test invalid slug format
      errors = product.validate({ name: 'Test Product', slug: 'Invalid Slug!' });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.field === 'slug')).toBe(true);
      
      // Test valid data
      errors = product.validate({ name: 'Test Product', slug: 'test-product' });
      const nameSlugErrors = errors.filter(e => e.field === 'name' || e.field === 'slug');
      expect(nameSlugErrors).toHaveLength(0);
    });

    it('should sanitize product data correctly', () => {
      const product = new Product();
      const sanitized = product.sanitize({
        name: '  Pokemon Booster Pack  ',
        slug: '  POKEMON-BOOSTER-PACK  ',
        sku: '  pkm001  '
      });
      
      expect(sanitized.name).toBe('Pokemon Booster Pack');
      expect(sanitized.slug).toBe('pokemon-booster-pack');
      expect(sanitized.sku).toBe('PKM001');
      expect(sanitized.is_active).toBe(true);
      expect(sanitized.popularity_score).toBe(0);
    });
  });

  describe('Watch Model Validation', () => {
    it('should validate required fields', () => {
      const watch = new Watch();
      
      // Test required user_id
      let errors = watch.validate({ user_id: '' });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.field === 'user_id')).toBe(true);
      
      // Test required product_id
      errors = watch.validate({ user_id: 'user-123', product_id: '' });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.field === 'product_id')).toBe(true);
      
      // Test valid data
      errors = watch.validate({ user_id: 'user-123', product_id: 'product-123' });
      const requiredErrors = errors.filter(e => e.field === 'user_id' || e.field === 'product_id');
      expect(requiredErrors).toHaveLength(0);
    });

    it('should sanitize watch data correctly', () => {
      const watch = new Watch();
      const sanitized = watch.sanitize({
        user_id: 'user-123',
        product_id: 'product-123',
        zip_code: '  12345  '
      });
      
      expect(sanitized.zip_code).toBe('12345');
      expect(Array.isArray(sanitized.retailer_ids)).toBe(true);
      expect(typeof sanitized.alert_preferences).toBe('object');
      expect(sanitized.is_active).toBe(true);
      expect(sanitized.alert_count).toBe(0);
    });
  });

  describe('Alert Model Validation', () => {
    it('should validate required fields', () => {
      const alert = new Alert();
      
      // Test required user_id
      let errors = alert.validate({ user_id: '' });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.field === 'user_id')).toBe(true);
      
      // Test valid data with all required fields
      errors = alert.validate({
        user_id: 'user-123',
        product_id: 'product-123',
        retailer_id: 'retailer-123',
        type: 'restock',
        priority: 'high',
        data: {
          product_name: 'Test Product',
          retailer_name: 'Test Retailer',
          availability_status: 'in_stock',
          product_url: 'https://example.com/product'
        }
      });
      
      const requiredErrors = errors.filter(e => 
        ['user_id', 'product_id', 'retailer_id', 'data'].includes(e.field)
      );
      expect(requiredErrors).toHaveLength(0);
    });

    it('should sanitize alert data correctly', () => {
      const alert = new Alert();
      const sanitized = alert.sanitize({
        user_id: 'user-123',
        product_id: 'product-123',
        retailer_id: 'retailer-123',
        failure_reason: '  Network timeout  '
      });
      
      expect(Array.isArray(sanitized.delivery_channels)).toBe(true);
      expect(typeof sanitized.data).toBe('object');
      expect(sanitized.status).toBe('pending');
      expect(sanitized.retry_count).toBe(0);
      expect(sanitized.priority).toBe('medium');
      expect(sanitized.failure_reason).toBe('Network timeout');
    });
  });

  describe('Password Hashing', () => {
    it('should hash and verify passwords correctly', async () => {
      const password = 'testpassword123';
      const hash = await User.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
      
      const isValid = await User.verifyPassword(password, hash);
      expect(isValid).toBe(true);
      
      const isInvalid = await User.verifyPassword('wrongpassword', hash);
      expect(isInvalid).toBe(false);
    });
  });
});