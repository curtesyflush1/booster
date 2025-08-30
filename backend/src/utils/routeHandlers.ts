import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest, AdminRequest, OptionalAuthRequest, isAuthenticatedRequest, isAdminRequest } from '../types/express';
import { logger } from './logger';

/**
 * Error response format for consistent API responses
 */
interface ErrorResponse {
  error: string;
  code: string;
  timestamp: string;
  details?: any;
}

/**
 * Creates a standardized error response
 */
const createErrorResponse = (error: string, code: string, details?: any): ErrorResponse => ({
  error,
  code,
  timestamp: new Date().toISOString(),
  ...(details && { details })
});

/**
 * Wrapper for authenticated route handlers with proper type safety
 * Ensures user is authenticated before calling the handler
 */
export const authenticatedHandler = (
  handler: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void> | void
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isAuthenticatedRequest(req)) {
        return res.status(401).json(
          createErrorResponse('Authentication required', 'AUTH_REQUIRED')
        );
      }
      
      return await handler(req, res, next);
    } catch (error) {
      logger.error('Authenticated route handler error', {
        path: req.path,
        method: req.method,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return next(error);
    }
  };
};

/**
 * Wrapper for admin route handlers with proper type safety
 * Ensures user is authenticated and has admin role
 */
export const adminHandler = (
  handler: (req: AdminRequest, res: Response, next: NextFunction) => Promise<void> | void
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isAuthenticatedRequest(req)) {
        return res.status(401).json(
          createErrorResponse('Authentication required', 'AUTH_REQUIRED')
        );
      }

      if (!isAdminRequest(req)) {
        return res.status(403).json(
          createErrorResponse('Admin access required', 'ADMIN_REQUIRED')
        );
      }

      return await handler(req, res, next);
    } catch (error) {
      logger.error('Admin route handler error', {
        path: req.path,
        method: req.method,
        userId: req.user?.id,
        userRole: req.user?.role,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return next(error);
    }
  };
};

/**
 * Wrapper for optional authentication routes
 * Handler receives user if authenticated, undefined otherwise
 */
export const optionalAuthHandler = (
  handler: (req: OptionalAuthRequest, res: Response, next: NextFunction) => Promise<void> | void
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      return await handler(req as OptionalAuthRequest, res, next);
    } catch (error) {
      logger.error('Optional auth route handler error', {
        path: req.path,
        method: req.method,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return next(error);
    }
  };
};

/**
 * Generic async handler wrapper that catches errors and passes them to error middleware
 * Use for routes that don't need authentication
 */
export const asyncHandler = (
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void> | void
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      return await handler(req, res, next);
    } catch (error) {
      logger.error('Route handler error', {
        path: req.path,
        method: req.method,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return next(error);
    }
  };
};

/**
 * Validation wrapper that ensures request body/query matches expected schema
 * Can be combined with other handlers
 */
export const withValidation = <T>(
  validator: (data: any) => T,
  handler: (req: Request & { validated: T }, res: Response, next: NextFunction) => Promise<void> | void
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = validator({ ...req.body, ...req.query, ...req.params });
      (req as any).validated = validated;
      return await handler(req as Request & { validated: T }, res, next);
    } catch (error) {
      if (error instanceof Error && error.name === 'ValidationError') {
        return res.status(400).json(
          createErrorResponse('Validation failed', 'VALIDATION_ERROR', error.message)
        );
      }
      return next(error);
    }
  };
};