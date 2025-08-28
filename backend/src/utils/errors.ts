import { CorrelationIdManager } from './logger';

/**
 * Enhanced AppError interface with additional context for debugging
 */
export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
  context?: Record<string, any>;
  userId?: string;
  operation?: string;
  correlationId?: string;
  timestamp?: string;
}

/**
 * Base class for application errors with enhanced debugging context
 */
export class BaseAppError extends Error implements AppError {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, any>;
  public readonly userId?: string;
  public readonly operation?: string;
  public readonly correlationId?: string;
  public readonly timestamp: string;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    context?: Record<string, any>,
    userId?: string,
    operation?: string
  ) {
    super(message);
    
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.context = context;
    this.userId = userId;
    this.operation = operation;
    this.correlationId = CorrelationIdManager.getId();
    this.timestamp = new Date().toISOString();
    
    // Capture stack trace excluding this constructor
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Specific error classes for common scenarios
 */
export class ValidationError extends BaseAppError {
  constructor(message: string, context?: Record<string, any>, userId?: string) {
    super(message, 400, 'VALIDATION_ERROR', true, context, userId, 'validation');
  }
}

export class AuthenticationError extends BaseAppError {
  constructor(message: string = 'Authentication failed', context?: Record<string, any>) {
    super(message, 401, 'AUTHENTICATION_ERROR', true, context, undefined, 'authentication');
  }
}

export class AuthorizationError extends BaseAppError {
  constructor(message: string = 'Access denied', context?: Record<string, any>, userId?: string) {
    super(message, 403, 'AUTHORIZATION_ERROR', true, context, userId, 'authorization');
  }
}

export class NotFoundError extends BaseAppError {
  constructor(resource: string, identifier?: string, userId?: string) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    
    super(message, 404, 'NOT_FOUND', true, { resource, identifier }, userId, 'resource_lookup');
  }
}

export class ConflictError extends BaseAppError {
  constructor(message: string, context?: Record<string, any>, userId?: string) {
    super(message, 409, 'CONFLICT_ERROR', true, context, userId, 'conflict_resolution');
  }
}

export class RateLimitError extends BaseAppError {
  constructor(limit: number, windowMs: number, userId?: string) {
    const message = `Rate limit exceeded: ${limit} requests per ${windowMs}ms`;
    super(message, 429, 'RATE_LIMIT_EXCEEDED', true, { limit, windowMs }, userId, 'rate_limiting');
  }
}

export class DatabaseError extends BaseAppError {
  constructor(message: string, originalError?: Error, operation?: string, userId?: string) {
    super(message, 500, 'DATABASE_ERROR', false, { originalError: originalError?.message }, userId, operation);
    
    if (originalError) {
      (this as any).cause = originalError;
    }
  }
}

export class ExternalServiceError extends BaseAppError {
  constructor(service: string, message: string, statusCode?: number, userId?: string) {
    super(`External service error (${service}): ${message}`, 502, 'EXTERNAL_SERVICE_ERROR', true, 
          { service, externalStatusCode: statusCode }, userId, `external_service_${service}`);
  }
}

/**
 * Utility functions for error handling and creation
 */
export class ErrorUtils {
  /**
   * Create a contextual error with automatic correlation ID and operation detection
   */
  static createError(
    message: string,
    options: {
      statusCode?: number;
      code?: string;
      operation?: string;
      context?: Record<string, any>;
      userId?: string;
      cause?: Error;
      isOperational?: boolean;
    } = {}
  ): AppError {
    const error = new BaseAppError(
      message,
      options.statusCode,
      options.code,
      options.isOperational,
      options.context,
      options.userId,
      options.operation
    );
    
    if (options.cause) {
      (error as any).cause = options.cause;
    }
    
    return error;
  }

  /**
   * Wrap an existing error with additional context
   */
  static wrapError(
    originalError: Error,
    message?: string,
    options: {
      statusCode?: number;
      code?: string;
      operation?: string;
      context?: Record<string, any>;
      userId?: string;
    } = {}
  ): AppError {
    const wrappedMessage = message || `Wrapped error: ${originalError.message}`;
    
    const error = new BaseAppError(
      wrappedMessage,
      options.statusCode,
      options.code,
      true,
      options.context,
      options.userId,
      options.operation
    );
    
    (error as any).cause = originalError;
    return error;
  }

  /**
   * Check if an error is operational (safe to expose to users)
   */
  static isOperationalError(error: Error): boolean {
    if (error instanceof BaseAppError) {
      return error.isOperational;
    }
    
    // Check for common operational error patterns
    const operationalErrorNames = [
      'ValidationError',
      'CastError',
      'MongoError',
      'SequelizeValidationError'
    ];
    
    return operationalErrorNames.includes(error.name);
  }

  /**
   * Extract safe error information for client responses
   */
  static getSafeErrorInfo(error: Error): {
    message: string;
    code: string;
    statusCode: number;
    correlationId?: string;
  } {
    if (error instanceof BaseAppError) {
      return {
        message: error.isOperational ? error.message : 'Internal Server Error',
        code: error.code,
        statusCode: error.statusCode,
        correlationId: error.correlationId
      };
    }
    
    // Default safe response for unknown errors
    return {
      message: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      correlationId: CorrelationIdManager.getId()
    };
  }

  /**
   * Create error from HTTP response for external service calls
   */
  static fromHttpResponse(
    service: string,
    response: { status: number; statusText: string; data?: any },
    operation?: string
  ): ExternalServiceError {
    const message = `HTTP ${response.status} ${response.statusText}`;
    return new ExternalServiceError(service, message, response.status);
  }
}

/**
 * Async wrapper that automatically converts thrown errors to AppErrors
 */
export const asyncErrorHandler = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  operation?: string
) => {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof BaseAppError) {
        throw error;
      }
      
      // Wrap unknown errors
      throw ErrorUtils.wrapError(error as Error, undefined, { operation });
    }
  };
};

/**
 * Express async route wrapper that handles errors automatically
 */
export const asyncRouteHandler = (
  fn: (req: any, res: any, next: any) => Promise<any>
) => {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};