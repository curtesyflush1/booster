import {
  ModelError,
  ValidationError,
  NotFoundError,
  DuplicateError,
  DatabaseOperationError,
  handleModelError
} from '../../src/utils/errors';

describe('Error Classes', () => {
  describe('ModelError', () => {
    it('should create error with message and code', () => {
      const error = new ModelError('Test message', 'TEST_CODE');
      
      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('ModelError');
      expect(error.field).toBeUndefined();
      expect(error.originalError).toBeUndefined();
    });

    it('should create error with all properties', () => {
      const originalError = new Error('Original');
      const error = new ModelError('Test message', 'TEST_CODE', 'field_name', originalError);
      
      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.field).toBe('field_name');
      expect(error.originalError).toBe(originalError);
    });
  });

  describe('ValidationError', () => {
    it('should create validation error', () => {
      const error = new ValidationError('Invalid email', 'email', 'invalid@');
      
      expect(error.message).toBe('Invalid email');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.field).toBe('email');
      expect(error.name).toBe('ValidationError');
    });

    it('should create validation error without field', () => {
      const error = new ValidationError('General validation error');
      
      expect(error.message).toBe('General validation error');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.field).toBeUndefined();
    });
  });

  describe('NotFoundError', () => {
    it('should create not found error with identifier', () => {
      const error = new NotFoundError('User', 'user123');
      
      expect(error.message).toBe("User with identifier 'user123' not found");
      expect(error.code).toBe('NOT_FOUND');
      expect(error.name).toBe('NotFoundError');
    });

    it('should create not found error without identifier', () => {
      const error = new NotFoundError('User');
      
      expect(error.message).toBe('User not found');
      expect(error.code).toBe('NOT_FOUND');
    });
  });

  describe('DuplicateError', () => {
    it('should create duplicate error', () => {
      const error = new DuplicateError('User', 'email', 'test@example.com');
      
      expect(error.message).toBe("User with email 'test@example.com' already exists");
      expect(error.code).toBe('DUPLICATE_ERROR');
      expect(error.field).toBe('email');
      expect(error.name).toBe('DuplicateError');
    });
  });

  describe('DatabaseOperationError', () => {
    it('should create database operation error', () => {
      const originalError = new Error('Connection failed');
      const error = new DatabaseOperationError('create', originalError);
      
      expect(error.message).toBe('Database create operation failed: Connection failed');
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.originalError).toBe(originalError);
      expect(error.name).toBe('DatabaseOperationError');
    });
  });
});

describe('handleModelError', () => {
  it('should re-throw ModelError instances', () => {
    const modelError = new ValidationError('Test validation error');
    
    expect(() => handleModelError(modelError, 'test')).toThrow(modelError);
  });

  it('should handle unique constraint violation (23505)', () => {
    const dbError = {
      code: '23505',
      detail: 'Key (email)=(test@example.com) already exists'
    };
    
    expect(() => handleModelError(dbError, 'create')).toThrow(DuplicateError);
    
    try {
      handleModelError(dbError, 'create');
    } catch (error) {
      expect(error).toBeInstanceOf(DuplicateError);
      expect((error as DuplicateError).message).toContain('email');
      expect((error as DuplicateError).message).toContain('test@example.com');
    }
  });

  it('should handle foreign key constraint violation (23503)', () => {
    const dbError = {
      code: '23503',
      detail: 'Key (user_id)=(123) is not present in table "users"'
    };
    
    expect(() => handleModelError(dbError, 'create')).toThrow(ModelError);
    
    try {
      handleModelError(dbError, 'create');
    } catch (error) {
      expect(error).toBeInstanceOf(ModelError);
      expect((error as ModelError).code).toBe('FOREIGN_KEY_ERROR');
      expect((error as ModelError).message).toContain('Referenced resource does not exist');
    }
  });

  it('should handle not null constraint violation (23502)', () => {
    const dbError = {
      code: '23502',
      column: 'email'
    };
    
    expect(() => handleModelError(dbError, 'create')).toThrow(ValidationError);
    
    try {
      handleModelError(dbError, 'create');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).field).toBe('email');
      expect((error as ValidationError).message).toContain('email is required');
    }
  });

  it('should handle not null constraint without column', () => {
    const dbError = {
      code: '23502'
    };
    
    expect(() => handleModelError(dbError, 'create')).toThrow(ValidationError);
    
    try {
      handleModelError(dbError, 'create');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).field).toBe('unknown field');
    }
  });

  it('should handle generic database errors', () => {
    const dbError = new Error('Connection timeout');
    
    expect(() => handleModelError(dbError, 'update')).toThrow(DatabaseOperationError);
    
    try {
      handleModelError(dbError, 'update');
    } catch (error) {
      expect(error).toBeInstanceOf(DatabaseOperationError);
      expect((error as DatabaseOperationError).originalError).toBe(dbError);
      expect((error as DatabaseOperationError).message).toContain('update operation failed');
    }
  });

  it('should handle unknown database constraint errors', () => {
    const dbError = {
      code: '23514', // Check constraint violation
      message: 'Check constraint failed'
    };
    
    expect(() => handleModelError(dbError, 'create')).toThrow(DatabaseOperationError);
  });
});