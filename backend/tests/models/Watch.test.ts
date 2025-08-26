import { Watch } from '../../src/models/Watch';

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

describe('Watch Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validation', () => {
    it('should validate required user_id', () => {
      const watch = new Watch();
      const errors = watch.validate({ user_id: '' });
      
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('user_id');
      expect(errors[0]?.message).toContain('user_id is required');
    });

    it('should validate required product_id', () => {
      const watch = new Watch();
      const errors = watch.validate({ 
        user_id: 'user-123',
        product_id: '' 
      });
      
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('product_id');
      expect(errors[0]?.message).toContain('product_id is required');
    });

    it('should validate max_price range', () => {
      const watch = new Watch();
      const errors = watch.validate({ 
        user_id: 'user-123',
        product_id: 'product-123',
        max_price: -10
      });
      
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('max_price');
      expect(errors[0]?.message).toContain('at least 0');
    });

    it('should validate availability_type enum', () => {
      const watch = new Watch();
      const errors = watch.validate({ 
        user_id: 'user-123',
        product_id: 'product-123',
        availability_type: 'invalid' as any
      });
      
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('availability_type');
      expect(errors[0]?.message).toContain('must be one of: online, in_store, both');
    });

    it('should validate ZIP code format', () => {
      const watch = new Watch();
      const errors = watch.validate({ 
        user_id: 'user-123',
        product_id: 'product-123',
        zip_code: 'invalid'
      });
      
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('zip_code');
      expect(errors[0]?.message).toContain('format 12345 or 12345-6789');
    });

    it('should validate radius_miles range', () => {
      const watch = new Watch();
      const errors = watch.validate({ 
        user_id: 'user-123',
        product_id: 'product-123',
        radius_miles: 0
      });
      
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('radius_miles');
      expect(errors[0]?.message).toContain('at least 1');
    });

    it('should pass validation with valid data', () => {
      const watch = new Watch();
      const errors = watch.validate({
        user_id: 'user-123',
        product_id: 'product-123',
        retailer_ids: ['retailer-1', 'retailer-2'],
        max_price: 50.00,
        availability_type: 'both',
        zip_code: '12345',
        radius_miles: 25,
        alert_count: 5
      });
      
      expect(errors).toHaveLength(0);
    });
  });

  describe('sanitization', () => {
    it('should trim ZIP code', () => {
      const watch = new Watch();
      const sanitized = watch.sanitize({
        user_id: 'user-123',
        product_id: 'product-123',
        zip_code: '  12345  '
      });
      
      expect(sanitized.zip_code).toBe('12345');
    });

    it('should ensure retailer_ids is an array', () => {
      const watch = new Watch();
      const sanitized = watch.sanitize({
        user_id: 'user-123',
        product_id: 'product-123',
        retailer_ids: undefined as any
      });
      
      expect(Array.isArray(sanitized.retailer_ids)).toBe(true);
      expect(sanitized.retailer_ids).toEqual([]);
    });

    it('should ensure alert_preferences is an object', () => {
      const watch = new Watch();
      const sanitized = watch.sanitize({
        user_id: 'user-123',
        product_id: 'product-123'
      });
      
      expect(typeof sanitized.alert_preferences).toBe('object');
      expect(sanitized.alert_preferences).toEqual({});
    });

    it('should set default values', () => {
      const watch = new Watch();
      const sanitized = watch.sanitize({
        user_id: 'user-123',
        product_id: 'product-123'
      });
      
      expect(sanitized.is_active).toBe(true);
      expect(sanitized.alert_count).toBe(0);
      expect(sanitized.availability_type).toBe('both');
    });
  });

  describe('ZIP code validation', () => {
    it('should accept valid ZIP codes', () => {
      const watch = new Watch();
      
      const validZipCodes = [
        '12345',
        '12345-6789',
        '90210',
        '10001-1234'
      ];

      validZipCodes.forEach(zip_code => {
        const errors = watch.validate({
          user_id: 'user-123',
          product_id: 'product-123',
          zip_code
        });
        
        const zipErrors = errors.filter(e => e.field === 'zip_code');
        expect(zipErrors).toHaveLength(0);
      });
    });

    it('should reject invalid ZIP codes', () => {
      const watch = new Watch();
      
      const invalidZipCodes = [
        '1234', // too short
        '123456', // too long without dash
        '12345-678', // invalid extended format
        '12345-67890', // extended part too long
        'ABCDE', // letters
        '12-345', // dash in wrong place
        '12345 6789' // space instead of dash
      ];

      invalidZipCodes.forEach(zip_code => {
        const errors = watch.validate({
          user_id: 'user-123',
          product_id: 'product-123',
          zip_code
        });
        
        const zipErrors = errors.filter(e => e.field === 'zip_code');
        expect(zipErrors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('availability type validation', () => {
    it('should accept valid availability types', () => {
      const watch = new Watch();
      
      const validTypes = ['online', 'in_store', 'both'];

      validTypes.forEach(availability_type => {
        const errors = watch.validate({
          user_id: 'user-123',
          product_id: 'product-123',
          availability_type: availability_type as any
        });
        
        const typeErrors = errors.filter(e => e.field === 'availability_type');
        expect(typeErrors).toHaveLength(0);
      });
    });

    it('should reject invalid availability types', () => {
      const watch = new Watch();
      
      const invalidTypes = ['everywhere', 'nowhere', 'maybe', ''];

      invalidTypes.forEach(availability_type => {
        const errors = watch.validate({
          user_id: 'user-123',
          product_id: 'product-123',
          availability_type: availability_type as any
        });
        
        const typeErrors = errors.filter(e => e.field === 'availability_type');
        expect(typeErrors.length).toBeGreaterThan(0);
      });
    });
  });
});