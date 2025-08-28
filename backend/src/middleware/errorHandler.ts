/**
 * Enhanced Error Handler Middleware for BoosterBeacon
 * 
 * This module provides comprehensive error handling with:
 * - Detailed logging with correlation IDs and request context
 * - Sensitive data sanitization for security
 * - Stack trace analysis for debugging
 * - Environment-specific error responses
 * - Configurable error handler factory
 * - Performance optimizations
 * 
 * Usage:
 * ```typescript
 * // Use default error handler
 * app.use(errorHandler);
 * 
 * // Use environment-specific handlers
 * app.use(process.env.NODE_ENV === 'production' ? productionErrorHandler : developmentErrorHandler);
 * 
 * // Create custom error handler
 * const customHandler = createErrorHandler({
 *   includeStackTrace: false,
 *   maxStackMethods: 5
 * });
 * app.use(customHandler);
 * ```
 * 
 * @author BoosterBeacon Team
 * @version 2.0.0
 */

import { Request, Response, NextFunction } from 'express';
import { loggerWithContext, CorrelationIdManager } from '../utils/logger';
import { AppError, ErrorUtils } from '../utils/errors';

/**
 * Constants for error handler configuration
 */
const MAX_STACK_METHODS = 10;
const MAX_DEBUG_METHODS = 3;
const PRODUCTION_ERROR_MESSAGE = 'Internal Server Error';

/**
 * Pre-compiled regex for better performance in stack trace parsing
 */
const STACK_TRACE_REGEX = /at\s+(?:([^.\s]+)\.)?([^.\s(]+)\s*\(/;

/**
 * Extract method names from stack trace for better debugging context
 * Optimized for performance with pre-compiled regex and early returns
 */
const extractMethodNames = (stack?: string): string[] => {
  if (!stack) return [];
  
  const methodNames: string[] = [];
  const lines = stack.split('\n');
  
  // Early return if no stack lines
  if (lines.length === 0) return [];
  
  for (let i = 0; i < lines.length && methodNames.length < MAX_STACK_METHODS; i++) {
    const line = lines[i];
    const matches = line.match(STACK_TRACE_REGEX);
    
    if (matches) {
      const className = matches[1];
      const methodName = matches[2];
      
      // Skip anonymous functions and common noise
      if (methodName && 
          methodName !== 'anonymous' && 
          !methodName.startsWith('Object.') &&
          !methodName.startsWith('Module.')) {
        methodNames.push(className ? `${className}.${methodName}` : methodName);
      }
    }
  }
  
  return methodNames;
};

/**
 * Sanitize request body for logging (remove sensitive data)
 */
const sanitizeRequestBody = (body: any): any => {
  if (!body || typeof body !== 'object') return body;
  
  const sensitiveFields = [
    'password', 'token', 'secret', 'key', 'authorization', 'cookie',
    'apiKey', 'api_key', 'accessToken', 'refreshToken', 'sessionId',
    'creditCard', 'ssn', 'socialSecurityNumber'
  ];
  
  const sanitized = { ...body };
  
  // Handle nested objects recursively
  const sanitizeRecursive = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    
    const result = Array.isArray(obj) ? [] : {};
    
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveFields.some(field => 
        lowerKey.includes(field.toLowerCase())
      );
      
      if (isSensitive) {
        (result as any)[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        (result as any)[key] = sanitizeRecursive(value);
      } else {
        (result as any)[key] = value;
      }
    }
    
    return result;
  };
  
  return sanitizeRecursive(sanitized);
};

/**
 * Extract additional context from request for enhanced logging
 */
const extractRequestContext = (req: Request) => {
  const correlationId = CorrelationIdManager.getId() || (req as any).correlationId || req.headers['x-correlation-id'];
  
  return {
    method: req.method,
    url: req.url,
    originalUrl: req.originalUrl,
    path: req.path,
    query: req.query,
    params: req.params,
    body: sanitizeRequestBody(req.body),
    headers: {
      'user-agent': req.get('User-Agent'),
      'content-type': req.get('Content-Type'),
      'accept': req.get('Accept'),
      'origin': req.get('Origin'),
      'referer': req.get('Referer'),
      'x-forwarded-for': req.get('X-Forwarded-For'),
      'x-real-ip': req.get('X-Real-IP')
    },
    ip: req.ip,
    ips: req.ips,
    protocol: req.protocol,
    secure: req.secure,
    correlationId,
    requestId: req.headers['x-request-id'] || correlationId,
    timestamp: new Date().toISOString(),
    // Add user context if available
    userId: (req as any).user?.id || (req as any).userId,
    userRole: (req as any).user?.role
  };
};

/**
 * Map specific error types to appropriate HTTP status codes and error codes
 */
const mapErrorToHttpStatus = (err: AppError): { statusCode: number; code: string; message: string } => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let code = err.code || 'INTERNAL_ERROR';

  // Handle specific error types with a lookup map for better maintainability
  const errorMappings: Record<string, { statusCode: number; code: string; message?: string }> = {
    'ValidationError': { statusCode: 400, code: 'VALIDATION_ERROR' },
    'UnauthorizedError': { statusCode: 401, code: 'UNAUTHORIZED' },
    'JsonWebTokenError': { statusCode: 401, code: 'INVALID_TOKEN', message: 'Invalid authentication token' },
    'TokenExpiredError': { statusCode: 401, code: 'TOKEN_EXPIRED', message: 'Authentication token has expired' },
    'CastError': { statusCode: 400, code: 'INVALID_ID_FORMAT' },
    'MongoError': { statusCode: 500, code: 'DATABASE_ERROR' },
    'SequelizeValidationError': { statusCode: 400, code: 'VALIDATION_ERROR' }
  };

  const mapping = errorMappings[err.name];
  if (mapping) {
    statusCode = mapping.statusCode;
    code = mapping.code;
    if (mapping.message) {
      message = mapping.message;
    }
  }

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal Server Error';
  }

  return { statusCode, code, message };
};

/**
 * Create comprehensive error context for logging
 */
const createErrorContext = (err: AppError, req: Request) => {
  const requestContext = extractRequestContext(req);
  const methodNames = extractMethodNames(err.stack);
  
  return {
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
      statusCode: err.statusCode,
      code: err.code,
      isOperational: err.isOperational,
      operation: err.operation,
      context: err.context,
      methodNames,
      // Add cause chain if available (Node.js 16.9.0+)
      cause: (err as any).cause ? {
        name: ((err as any).cause as Error)?.name,
        message: ((err as any).cause as Error)?.message,
        stack: ((err as any).cause as Error)?.stack
      } : undefined
    },
    request: requestContext,
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      pid: process.pid
    },
    timing: {
      errorTime: new Date().toISOString(),
      // Calculate request duration if start time is available
      requestDuration: (req as any).startTime ? Date.now() - (req as any).startTime : undefined
    }
  };
};

/**
 * Create client-safe response payload
 */
const createResponsePayload = (
  err: AppError, 
  safeErrorInfo: ReturnType<typeof ErrorUtils.getSafeErrorInfo>,
  requestContext: ReturnType<typeof extractRequestContext>,
  methodNames: string[]
) => {
  return {
    error: {
      ...safeErrorInfo,
      timestamp: new Date().toISOString(),
      requestId: requestContext.requestId,
      correlationId: requestContext.correlationId,
      // Include additional debug info in development
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack,
        methodNames: methodNames.slice(0, MAX_DEBUG_METHODS),
        operation: err.operation,
        context: err.context
      })
    }
  };
};

/**
 * Configuration interface for error handler customization
 */
export interface ErrorHandlerConfig {
  /** Whether to include stack traces in responses (default: development only) */
  includeStackTrace?: boolean;
  /** Whether to include system information in logs (default: true) */
  includeSystemInfo?: boolean;
  /** Maximum number of stack methods to extract (default: 10) */
  maxStackMethods?: number;
  /** Additional sensitive fields to sanitize from request bodies */
  sensitiveFields?: string[];
  /** Custom error type mappings for specific error handling */
  customErrorMappings?: Record<string, { statusCode: number; code: string; message?: string }>;
  /** Custom logger instance to use instead of default */
  logger?: typeof loggerWithContext;
}

/**
 * Type for the error handler function signature
 */
export type ErrorHandlerFunction = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => void;

/**
 * Request context extracted for error logging
 */
export interface RequestContext {
  method: string;
  url: string;
  originalUrl: string;
  path: string;
  query: any;
  params: any;
  body: any;
  headers: Record<string, string | undefined>;
  ip: string;
  ips: string[];
  protocol: string;
  secure: boolean;
  correlationId: string | undefined;
  requestId: string | undefined;
  timestamp: string;
  userId?: string;
  userRole?: string;
}

/**
 * Simple error metrics collection
 */
class ErrorMetrics {
  private static instance: ErrorMetrics;
  private errorCounts: Map<string, number> = new Map();
  private statusCodeCounts: Map<number, number> = new Map();
  private lastReset: Date = new Date();

  static getInstance(): ErrorMetrics {
    if (!ErrorMetrics.instance) {
      ErrorMetrics.instance = new ErrorMetrics();
    }
    return ErrorMetrics.instance;
  }

  recordError(errorName: string, statusCode: number): void {
    // Increment error type count
    const currentCount = this.errorCounts.get(errorName) || 0;
    this.errorCounts.set(errorName, currentCount + 1);

    // Increment status code count
    const currentStatusCount = this.statusCodeCounts.get(statusCode) || 0;
    this.statusCodeCounts.set(statusCode, currentStatusCount + 1);
  }

  getMetrics(): {
    errorCounts: Record<string, number>;
    statusCodeCounts: Record<number, number>;
    totalErrors: number;
    lastReset: Date;
  } {
    const errorCounts: Record<string, number> = {};
    const statusCodeCounts: Record<number, number> = {};
    let totalErrors = 0;

    this.errorCounts.forEach((count, errorName) => {
      errorCounts[errorName] = count;
      totalErrors += count;
    });

    this.statusCodeCounts.forEach((count, statusCode) => {
      statusCodeCounts[statusCode] = count;
    });

    return {
      errorCounts,
      statusCodeCounts,
      totalErrors,
      lastReset: this.lastReset
    };
  }

  reset(): void {
    this.errorCounts.clear();
    this.statusCodeCounts.clear();
    this.lastReset = new Date();
  }
}

/**
 * Factory function to create customized error handlers
 */
export const createErrorHandler = (config: ErrorHandlerConfig = {}) => {
  const {
    includeStackTrace = process.env.NODE_ENV === 'development',
    includeSystemInfo = true,
    maxStackMethods = MAX_STACK_METHODS,
    sensitiveFields = [],
    customErrorMappings = {}
  } = config;

  return (err: AppError, req: Request, res: Response, _next: NextFunction): void => {
    try {
      // Use custom configuration
      const requestContext = extractRequestContext(req);
      const methodNames = extractMethodNames(err.stack).slice(0, maxStackMethods);
      const { statusCode, code, message } = mapErrorToHttpStatus(err);
      const correlationId = requestContext.correlationId;

      // Create error context with configuration options
      const errorContext = {
        error: {
          name: err.name,
          message: err.message,
          ...(includeStackTrace && { stack: err.stack }),
          statusCode: err.statusCode,
          code: err.code,
          isOperational: err.isOperational,
          operation: err.operation,
          context: err.context,
          methodNames,
          cause: (err as any).cause ? {
            name: ((err as any).cause as Error)?.name,
            message: ((err as any).cause as Error)?.message,
            ...(includeStackTrace && { stack: ((err as any).cause as Error)?.stack })
          } : undefined
        },
        request: requestContext,
        ...(includeSystemInfo && {
          system: {
            nodeVersion: process.version,
            platform: process.platform,
            memory: process.memoryUsage(),
            uptime: process.uptime(),
            pid: process.pid
          }
        }),
        timing: {
          errorTime: new Date().toISOString(),
          requestDuration: (req as any).startTime ? Date.now() - (req as any).startTime : undefined
        }
      };

      // Log error with context
      const logger = config.logger || loggerWithContext;
      logger.error(`${err.name || 'Error'}: ${err.message}`, err, {
        ...errorContext,
        userId: requestContext.userId,
        operation: err.operation || `${req.method} ${req.path}`,
        correlationId
      });

      // Record error metrics
      ErrorMetrics.getInstance().recordError(err.name || 'UnknownError', statusCode);

      // Get safe error information and send response
      const safeErrorInfo = ErrorUtils.getSafeErrorInfo(err);
      const responsePayload = createResponsePayload(err, safeErrorInfo, requestContext, methodNames);
      
      res.status(safeErrorInfo.statusCode).json(responsePayload);
    } catch (handlerError) {
      // Fallback error handling
      console.error('Error handler failed:', handlerError);
      res.status(500).json({
        error: {
          message: PRODUCTION_ERROR_MESSAGE,
          code: 'ERROR_HANDLER_FAILURE',
          timestamp: new Date().toISOString(),
          correlationId: CorrelationIdManager.getId()
        }
      });
    }
  };
};

// Default error handler instance
export const errorHandler = createErrorHandler();

// Specialized error handlers for different environments
export const productionErrorHandler = createErrorHandler({
  includeStackTrace: false,
  includeSystemInfo: false,
  maxStackMethods: 3
});

export const developmentErrorHandler = createErrorHandler({
  includeStackTrace: true,
  includeSystemInfo: true,
  maxStackMethods: MAX_STACK_METHODS
});

export const apiErrorHandler = createErrorHandler({
  includeStackTrace: process.env.NODE_ENV === 'development',
  includeSystemInfo: false,
  maxStackMethods: 5
});

/**
 * Get current error metrics for monitoring
 */
export const getErrorMetrics = () => ErrorMetrics.getInstance().getMetrics();

/**
 * Reset error metrics (useful for testing or periodic resets)
 */
export const resetErrorMetrics = () => ErrorMetrics.getInstance().reset();