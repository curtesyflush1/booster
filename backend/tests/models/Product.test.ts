import { Product } from '../../src/models/Product';

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

describe('Product Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validation', () => {
    it('should validate required name', () => {
      const product = new Product();
      const errors = product.validate({ name: '' });
      
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('name');
      expect(errors[0]?.message).toContain('name is required');
    });

    it('should validate required slug', () => {
      const product = new Product();
      const errors = product.validate({ 
        name: 'Test Product',
        slug: '' 
      });
      
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('slug');
      expect(errors[0]?.message).toContain('slug is required');
    });

    it('should validate slug format', () => {
      const product = new Product();
      const errors = product.validate({ 
        name: 'Test Product',
        slug: 'Invalid Slug!' 
      });
      
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('slug');
      expect(errors[0]?.message).toContain('lowercase letters, numbers, and hyphens');
    });

    it('should validate UPC format', () => {
      const product = new Product();
      const errors = product.validate({ 
        name: 'Test Product',
        slug: 'test-product',
        upc: 'invalid-upc'
      });
      
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('upc');
      expect(errors[0]?.message).toContain('must contain only numbers');
    });

    it('should validate MSRP range', () => {
      const product = new Product();
      const errors = product.validate({ 
        name: 'Test Product',
        slug: 'test-product',
        msrp: -10
      });
      
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('msrp');
      expect(errors[0]?.message).toContain('at least 0');
    });

    it('should validate image URL format', () => {
      const product = new Product();
      const errors = product.validate({ 
        name: 'Test Product',
        slug: 'test-product',
        image_url: 'invalid-url'
      });
      
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('image_url');
      expect(errors[0]?.message).toContain('valid HTTP/HTTPS URL');
    });

    it('should pass validation with valid data', () => {
      const product = new Product();
      const errors = product.validate({
        name: 'Pokemon Booster Pack',
        slug: 'pokemon-booster-pack',
        sku: 'PKM001',
        upc: '123456789012',
        msrp: 4.99,
        image_url: 'https://example.com/image.jpg',
        set_name: 'Base Set',
        series: 'Classic',
        popularity_score: 85
      });
      
      expect(errors).toHaveLength(0);
    });
  });

  describe('sanitization', () => {
    it('should trim and format string fields', () => {
      const product = new Product();
      const sanitized = product.sanitize({
        name: '  Pokemon Booster Pack  ',
        slug: '  POKEMON-BOOSTER-PACK  ',
        sku: '  pkm001  ',
        upc: '  123456789012  ',
        set_name: '  Base Set  ',
        series: '  Classic  ',
        image_url: '  https://example.com/image.jpg  ',
        description: '  A great booster pack  '
      });
      
      expect(sanitized.name).toBe('Pokemon Booster Pack');
      expect(sanitized.slug).toBe('pokemon-booster-pack');
      expect(sanitized.sku).toBe('PKM001');
      expect(sanitized.upc).toBe('123456789012');
      expect(sanitized.set_name).toBe('Base Set');
      expect(sanitized.series).toBe('Classic');
      expect(sanitized.image_url).toBe('https://example.com/image.jpg');
      expect(sanitized.description).toBe('A great booster pack');
    });

    it('should set default values', () => {
      const product = new Product();
      const sanitized = product.sanitize({
        name: 'Test Product',
        slug: 'test-product'
      });
      
      expect(sanitized.metadata).toEqual({});
      expect(sanitized.is_active).toBe(true);
      expect(sanitized.popularity_score).toBe(0);
    });
  });

  describe('slug validation', () => {
    it('should accept valid slugs', () => {
      const product = new Product();
      
      const validSlugs = [
        'pokemon-booster-pack',
        'base-set-2',
        'xy-evolutions',
        'sword-shield-base',
        'product-123'
      ];

      validSlugs.forEach(slug => {
        const errors = product.validate({
          name: 'Test Product',
          slug
        });
        
        const slugErrors = errors.filter(e => e.field === 'slug');
        expect(slugErrors).toHaveLength(0);
      });
    });

    it('should reject invalid slugs', () => {
      const product = new Product();
      
      const invalidSlugs = [
        'Pokemon Booster Pack', // spaces
        'pokemon_booster_pack', // underscores
        'pokemon-booster-pack!', // special characters
        'POKEMON-BOOSTER-PACK', // uppercase
        'pokémon-booster-pack' // accented characters
      ];

      invalidSlugs.forEach(slug => {
        const errors = product.validate({
          name: 'Test Product',
          slug
        });
        
        const slugErrors = errors.filter(e => e.field === 'slug');
        expect(slugErrors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('UPC validation', () => {
    it('should accept valid UPC codes', () => {
      const product = new Product();
      
      const validUPCs = [
        '123456789012', // 12 digits
        '12345678', // 8 digits
        '1234567890123' // 13 digits
      ];

      validUPCs.forEach(upc => {
        const errors = product.validate({
          name: 'Test Product',
          slug: 'test-product',
          upc
        });
        
        const upcErrors = errors.filter(e => e.field === 'upc');
        expect(upcErrors).toHaveLength(0);
      });
    });

    it('should reject invalid UPC codes', () => {
      const product = new Product();
      
      const invalidUPCs = [
        '123456', // too short
        '123456789012345', // too long
        '12345678901a', // contains letters
        '123-456-789', // contains hyphens
        '123 456 789' // contains spaces
      ];

      invalidUPCs.forEach(upc => {
        const errors = product.validate({
          name: 'Test Product',
          slug: 'test-product',
          upc
        });
        
        const upcErrors = errors.filter(e => e.field === 'upc');
        expect(upcErrors.length).toBeGreaterThan(0);
      });
    });
  });
});