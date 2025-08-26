import { User } from '../../src/models/User';
import { Product } from '../../src/models/Product';

// Mock the database connection for unit tests
jest.mock('../../src/config/database', () => ({
  db: jest.fn(),
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

describe('Simple Model Validation Tests', () => {
  describe('User Model', () => {
    it('should validate email correctly', () => {
      const user = new User();
      
      // Test empty email
      let errors = user.validate({ email: '' });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.field === 'email')).toBe(true);
      
      // Test invalid email
      errors = user.validate({ email: 'invalid-email' });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.field === 'email')).toBe(true);
      
      // Test valid email
      errors = user.validate({ email: 'test@example.com' });
      const emailErrors = errors.filter(e => e.field === 'email');
      expect(emailErrors).toHaveLength(0);
    });

    it('should sanitize email correctly', () => {
      const user = new User();
      const sanitized = user.sanitize({ email: '  TEST@EXAMPLE.COM  ' });
      expect(sanitized.email).toBe('test@example.com');
    });

    it('should hash passwords correctly', async () => {
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

  describe('Product Model', () => {
    it('should validate product name', () => {
      const product = new Product();
      
      // Test empty name
      let errors = product.validate({ name: '' });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.field === 'name')).toBe(true);
      
      // Test valid name
      errors = product.validate({ name: 'Pokemon Booster Pack' });
      const nameErrors = errors.filter(e => e.field === 'name');
      expect(nameErrors).toHaveLength(0);
    });

    it('should validate slug format', () => {
      const product = new Product();
      
      // Test invalid slug
      let errors = product.validate({ 
        name: 'Test Product',
        slug: 'Invalid Slug!' 
      });
      expect(errors.some(e => e.field === 'slug')).toBe(true);
      
      // Test valid slug
      errors = product.validate({ 
        name: 'Test Product',
        slug: 'test-product' 
      });
      const slugErrors = errors.filter(e => e.field === 'slug');
      expect(slugErrors).toHaveLength(0);
    });

    it('should sanitize product data', () => {
      const product = new Product();
      const sanitized = product.sanitize({
        name: '  Pokemon Booster Pack  ',
        slug: '  POKEMON-BOOSTER-PACK  '
      });
      
      expect(sanitized.name).toBe('Pokemon Booster Pack');
      expect(sanitized.slug).toBe('pokemon-booster-pack');
      expect(sanitized.is_active).toBe(true);
    });
  });

  describe('Validation Helpers', () => {
    it('should validate required fields', () => {
      const error = User['validateRequired']('', 'test_field');
      expect(error).not.toBeNull();
      expect(error?.field).toBe('test_field');
      
      const noError = User['validateRequired']('value', 'test_field');
      expect(noError).toBeNull();
    });

    it('should validate email format', () => {
      const validEmail = User['validateEmail']('test@example.com');
      expect(validEmail).toBeNull();
      
      const invalidEmail = User['validateEmail']('invalid-email');
      expect(invalidEmail).not.toBeNull();
      expect(invalidEmail?.field).toBe('email');
    });

    it('should validate string length', () => {
      const tooShort = User['validateLength']('ab', 'test', 3, 10);
      expect(tooShort).not.toBeNull();
      
      const tooLong = User['validateLength']('abcdefghijk', 'test', 3, 10);
      expect(tooLong).not.toBeNull();
      
      const justRight = User['validateLength']('abcde', 'test', 3, 10);
      expect(justRight).toBeNull();
    });

    it('should validate numeric values', () => {
      const notNumber = User['validateNumeric']('abc', 'test');
      expect(notNumber).not.toBeNull();
      
      const tooSmall = User['validateNumeric'](5, 'test', 10, 20);
      expect(tooSmall).not.toBeNull();
      
      const justRight = User['validateNumeric'](15, 'test', 10, 20);
      expect(justRight).toBeNull();
    });

    it('should validate enum values', () => {
      const invalid = User['validateEnum']('invalid', 'test', ['valid1', 'valid2']);
      expect(invalid).not.toBeNull();
      
      const valid = User['validateEnum']('valid1', 'test', ['valid1', 'valid2']);
      expect(valid).toBeNull();
    });
  });
});