import { User } from '../../src/models/User';
import { db } from '../../src/config/database';
import { SubscriptionTier } from '../../src/types/subscription';

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

describe('User Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validation', () => {
    it('should validate required email', () => {
      const user = new User();
      const errors = user.validate({ email: '' });
      
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('email');
      expect(errors[0]?.message).toContain('email is required');
    });

    it('should validate email format', () => {
      const user = new User();
      const errors = user.validate({ email: 'invalid-email' });
      
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('email');
      expect(errors[0]?.message).toBe('Invalid email format');
    });

    it('should validate password length', () => {
      const user = new User();
      const errors = user.validate({ 
        email: 'test@example.com',
        password_hash: '123' // Too short
      });
      
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('password');
      expect(errors[0]?.message).toContain('at least 8 characters');
    });

    it('should validate subscription tier', () => {
      const user = new User();
      const errors = user.validate({ 
        email: 'test@example.com',
        subscription_tier: 'invalid' as any
      });
      
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('subscription_tier');
      expect(errors[0]?.message).toContain('must be one of: free, pro');
    });

    it('should pass validation with valid data', () => {
      const user = new User();
      const errors = user.validate({
        email: 'test@example.com',
        password_hash: 'validpassword123',
        subscription_tier: SubscriptionTier.FREE,
        first_name: 'John',
        last_name: 'Doe'
      });
      
      expect(errors).toHaveLength(0);
    });
  });

  describe('sanitization', () => {
    it('should trim and lowercase email', () => {
      const user = new User();
      const sanitized = user.sanitize({
        email: '  TEST@EXAMPLE.COM  '
      });
      
      expect(sanitized.email).toBe('test@example.com');
    });

    it('should trim names', () => {
      const user = new User();
      const sanitized = user.sanitize({
        first_name: '  John  ',
        last_name: '  Doe  '
      });
      
      expect(sanitized.first_name).toBe('John');
      expect(sanitized.last_name).toBe('Doe');
    });

    it('should set default arrays and objects', () => {
      const user = new User();
      const sanitized = user.sanitize({
        email: 'test@example.com'
      });
      
      expect(sanitized.shipping_addresses).toEqual([]);
      expect(sanitized.payment_methods).toEqual([]);
      expect(sanitized.retailer_credentials).toEqual({});
      expect(sanitized.notification_settings).toEqual({
        web_push: true,
        email: true,
        sms: false,
        discord: false
      });
      expect(sanitized.quiet_hours).toEqual({
        enabled: false,
        start_time: '22:00',
        end_time: '08:00',
        timezone: 'UTC',
        days: []
      });
      expect(sanitized.preferences).toEqual({});
    });
  });

  describe('password hashing', () => {
    it('should hash password', async () => {
      const password = 'testpassword123';
      const hash = await User.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50); // bcrypt hashes are long
    });

    it('should verify password against hash', async () => {
      const password = 'testpassword123';
      const hash = await User.hashPassword(password);
      
      const isValid = await User.verifyPassword(password, hash);
      expect(isValid).toBe(true);
      
      const isInvalid = await User.verifyPassword('wrongpassword', hash);
      expect(isInvalid).toBe(false);
    });
  });

  describe('static methods', () => {
    it('should validate required fields', () => {
      const error = User['validateRequired']('', 'test_field');
      expect(error).not.toBeNull();
      expect(error?.field).toBe('test_field');
      expect(error?.message).toContain('test_field is required');
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
      expect(tooShort?.message).toContain('at least 3 characters');
      
      const tooLong = User['validateLength']('abcdefghijk', 'test', 3, 10);
      expect(tooLong).not.toBeNull();
      expect(tooLong?.message).toContain('no more than 10 characters');
      
      const justRight = User['validateLength']('abcde', 'test', 3, 10);
      expect(justRight).toBeNull();
    });

    it('should validate numeric values', () => {
      const notNumber = User['validateNumeric']('abc', 'test');
      expect(notNumber).not.toBeNull();
      expect(notNumber?.message).toContain('must be a number');
      
      const tooSmall = User['validateNumeric'](5, 'test', 10, 20);
      expect(tooSmall).not.toBeNull();
      expect(tooSmall?.message).toContain('at least 10');
      
      const tooBig = User['validateNumeric'](25, 'test', 10, 20);
      expect(tooBig).not.toBeNull();
      expect(tooBig?.message).toContain('no more than 20');
      
      const justRight = User['validateNumeric'](15, 'test', 10, 20);
      expect(justRight).toBeNull();
    });

    it('should validate enum values', () => {
      const invalid = User['validateEnum']('invalid', 'test', ['valid1', 'valid2']);
      expect(invalid).not.toBeNull();
      expect(invalid?.message).toContain('must be one of: valid1, valid2');
      
      const valid = User['validateEnum']('valid1', 'test', ['valid1', 'valid2']);
      expect(valid).toBeNull();
    });
  });
});