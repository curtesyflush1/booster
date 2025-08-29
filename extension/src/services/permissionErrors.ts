// Custom error types for permission management
export class PermissionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retailerId?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'PermissionError';
  }
}

export class UnsupportedRetailerError extends PermissionError {
  constructor(retailerId: string) {
    super(
      `Retailer '${retailerId}' is not supported`,
      'UNSUPPORTED_RETAILER',
      retailerId
    );
    this.name = 'UnsupportedRetailerError';
  }
}

export class PermissionDeniedError extends PermissionError {
  constructor(retailerId: string, reason?: string) {
    super(
      `Permission denied for retailer '${retailerId}'${reason ? `: ${reason}` : ''}`,
      'PERMISSION_DENIED',
      retailerId
    );
    this.name = 'PermissionDeniedError';
  }
}

export class StorageError extends PermissionError {
  constructor(operation: string, cause?: Error) {
    super(
      `Storage operation failed: ${operation}`,
      'STORAGE_ERROR',
      undefined,
      cause
    );
    this.name = 'StorageError';
  }
}

// Result type for better error handling
export type PermissionResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: PermissionError;
};

// Helper function to create results
export function createSuccessResult<T>(data: T): PermissionResult<T> {
  return { success: true, data };
}

export function createErrorResult<T>(error: PermissionError): PermissionResult<T> {
  return { success: false, error };
}