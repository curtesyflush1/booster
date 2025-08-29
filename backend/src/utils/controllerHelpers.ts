import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';
import { AppError, ErrorUtils } from './errors';

/**
 * Standard success response format
 */
export interface StandardSuccessResponse<T = any> {
  success: true;
  data: T;
  timestamp: string;
  correlationId?: string;
}

/**
 * Standard error response format
 */
export interface StandardErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    timestamp: string;
    correlationId?: string;
    details?: any;
    stack?: string;
  };
}

/**
 * Send standardized success response
 */
export const sendSuccessResponse = <T>(
  res: Response,
  data: T,
  statusCode: number = 200
): void => {
  const response: StandardSuccessResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    correlationId: res.locals.correlationId
  };

  res.status(statusCode).json(response);
};

/**
 * Send standardized error response
 */
export const sendErrorResponse = (
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: any
): void => {
  const response: StandardErrorResponse = {
    success: false,
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
      correlationId: res.locals.correlationId,
      ...(details && { details }),
      ...(process.env.NODE_ENV === 'development' && details?.stack && { stack: details.stack })
    }
  };

  res.status(statusCode).json(response);
};

/**
 * Handle controller errors consistently
 */
export const handleControllerError = (
  error: Error | AppError,
  req: Request,
  next: NextFunction,
  operation: string
): void => {
  logger.error(`Error in ${operation}`, error, {
    operation,
    userId: (req as any).user?.id,
    method: req.method,
    url: req.url,
    correlationId: req.headers['x-correlation-id']
  });

  next(error);
};

/**
 * Higher-order function for wrapping controller methods with error handling
 */
export const withErrorHandling = <T extends any[]>(
  operation: string,
  handler: (...args: T) => Promise<void>
) => {
  return async (...args: T): Promise<void> => {
    const [req, res, next] = args as [Request, Response, NextFunction];
    try {
      await handler(...args);
    } catch (error) {
      handleControllerError(error as Error, req, next, operation);
    }
  };
};

/**
 * Async route wrapper that handles errors automatically
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation middleware creator
 */
export const createValidationMiddleware = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });
    
    if (error) {
      const validationErrors = error.details.map((detail: any) => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));
      
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Request validation failed', {
        errors: validationErrors
      });
    }
    
    req.body = value;
    next();
  };
};

/**
 * Error response factory for consistent error formatting
 */
export class ErrorResponseFactory {
  static createErrorResponse(
    error: AppError,
    req: Request
  ): StandardErrorResponse {
    const correlationId = req.headers['x-correlation-id'] as string;
    
    return {
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.isOperational ? error.message : 'Internal Server Error',
        timestamp: new Date().toISOString(),
        correlationId,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      }
    };
  }

  static createValidationErrorResponse(
    validationErrors: Array<{ field: string; message: string; value?: any }>,
    correlationId?: string
  ): StandardErrorResponse {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        timestamp: new Date().toISOString(),
        correlationId,
        details: { errors: validationErrors }
      }
    };
  }
}

/**
 * Pagination helper for consistent pagination responses
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export const createPaginationMeta = (
  page: number,
  limit: number,
  total: number
): PaginationMeta => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
};

export const sendPaginatedResponse = <T>(
  res: Response,
  data: T[],
  pagination: PaginationMeta,
  statusCode: number = 200
): void => {
  const response = {
    success: true,
    data,
    pagination,
    timestamp: new Date().toISOString(),
    correlationId: res.locals.correlationId
  };

  res.status(statusCode).json(response);
};