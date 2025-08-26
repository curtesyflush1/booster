import { BaseModel } from '../../src/models/BaseModel';
import { IValidationError } from '../../src/types/database';

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

// Create a test model for testing BaseModel functionality
class TestModel extends BaseModel<any> {
  protected static override tableName = 'test_table';

  validate(data: any): IValidationError[] {
    const errors: IValidationError[] = [];
    
    if (!data.name) {
      errors.push({
        field: 'name',
        message: 'Name is required',
        value: data.name
      });
    }
    
    return errors;
  }

  sanitize(data: any): any {
    return {
      ...data,
      name: data.name?.trim()
    };
  }
}

describe('BaseModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validation helpers', () => {
    it('should validate required fields', () => {
      const error = TestModel['validateRequired']('', 'test_field');
      expect(error).not.toBeNull();
      expect(error?.field).toBe('test_field');
      expect(error?.message).toContain('test_field is required');

      const noError = TestModel['validateRequired']('value', 'test_field');
      expect(noError).toBeNull();
    });

    it('should validate email format', () => {
      const validEmail = TestModel['validateEmail']('test@example.com');
      expect(validEmail).toBeNull();
      
      const invalidEmail = TestModel['validateEmail']('invalid-email');
      expect(invalidEmail).not.toBeNull();
      expect(invalidEmail?.field).toBe('email');
      expect(invalidEmail?.message).toBe('Invalid email format');
    });

    it('should validate string length', () => {
      const tooShort = TestModel['validateLength']('ab', 'test', 3, 10);
      expect(tooShort).not.toBeNull();
      expect(tooShort?.message).toContain('at least 3 characters');
      
      const tooLong = TestModel['validateLength']('abcdefghijk', 'test', 3, 10);
      expect(tooLong).not.toBeNull();
      expect(tooLong?.message).toContain('no more than 10 characters');
      
      const justRight = TestModel['validateLength']('abcde', 'test', 3, 10);
      expect(justRight).toBeNull();
    });

    it('should validate numeric values', () => {
      const notNumber = TestModel['validateNumeric']('abc', 'test');
      expect(notNumber).not.toBeNull();
      expect(notNumber?.message).toContain('must be a number');
      
      const tooSmall = TestModel['validateNumeric'](5, 'test', 10, 20);
      expect(tooSmall).not.toBeNull();
      expect(tooSmall?.message).toContain('at least 10');
      
      const tooBig = TestModel['validateNumeric'](25, 'test', 10, 20);
      expect(tooBig).not.toBeNull();
      expect(tooBig?.message).toContain('no more than 20');
      
      const justRight = TestModel['validateNumeric'](15, 'test', 10, 20);
      expect(justRight).toBeNull();
    });

    it('should validate enum values', () => {
      const invalid = TestModel['validateEnum']('invalid', 'test', ['valid1', 'valid2']);
      expect(invalid).not.toBeNull();
      expect(invalid?.message).toContain('must be one of: valid1, valid2');
      
      const valid = TestModel['validateEnum']('valid1', 'test', ['valid1', 'valid2']);
      expect(valid).toBeNull();
    });
  });

  describe('table name', () => {
    it('should return the correct table name', () => {
      expect(TestModel.getTableName()).toBe('test_table');
    });

    it('should throw error if table name not defined', () => {
      class NoTableModel extends BaseModel<any> {
        validate() { return []; }
        sanitize(data: any) { return data; }
      }

      expect(() => NoTableModel.getTableName()).toThrow('Table name not defined');
    });
  });

  describe('model validation and sanitization', () => {
    it('should validate data correctly', () => {
      const model = new TestModel();
      
      const errors = model.validate({ name: '' });
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('name');
      expect(errors[0]?.message).toBe('Name is required');
      
      const noErrors = model.validate({ name: 'Test Name' });
      expect(noErrors).toHaveLength(0);
    });

    it('should sanitize data correctly', () => {
      const model = new TestModel();
      
      const sanitized = model.sanitize({ name: '  Test Name  ' });
      expect(sanitized.name).toBe('Test Name');
    });
  });
});