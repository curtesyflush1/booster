/**
 * Standardized error classes for the model layer
 */

export class ModelError extends Error {
  constructor(
    message: string,
    public code: string,
    public field?: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ModelError';
  }
}

export class ValidationError extends ModelError {
  constructor(
    message: string,
    field?: string,
    value?: any
  ) {
    super(message, 'VALIDATION_ERROR', field);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ModelError {
  constructor(resource: string, identifier?: string) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class DuplicateError extends ModelError {
  constructor(resource: string, field: string, value: any) {
    super(
      `${resource} with ${field} '${value}' already exists`,
      'DUPLICATE_ERROR',
      field
    );
    this.name = 'DuplicateError';
  }
}

export class DatabaseOperationError extends ModelError {
  constructor(operation: string, originalError: Error) {
    super(
      `Database ${operation} operation failed: ${originalError.message}`,
      'DATABASE_ERROR',
      undefined,
      originalError
    );
    this.name = 'DatabaseOperationError';
  }
}

/**
 * Helper function to handle database errors consistently
 */
export function handleModelError(error: any, operation: string): never {
  if (error instanceof ModelError) {
    throw error;
  }
  
  // Handle common database constraint errors
  if (error.code === '23505') { // Unique constraint violation
    const match = error.detail?.match(/Key \((.+)\)=\((.+)\) already exists/);
    if (match) {
      throw new DuplicateError('Resource', match[1], match[2]);
    }
  }
  
  if (error.code === '23503') { // Foreign key constraint violation
    throw new ModelError(
      'Referenced resource does not exist',
      'FOREIGN_KEY_ERROR'
    );
  }
  
  if (error.code === '23502') { // Not null constraint violation
    const field = error.column || 'unknown field';
    throw new ValidationError(
      `${field} is required`,
      field
    );
  }
  
  throw new DatabaseOperationError(operation, error);
}