/**
 * Pagination Enforcement Middleware
 * 
 * Ensures all API endpoints that return multiple records use proper pagination
 * to prevent performance degradation and memory issues.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { DEFAULT_VALUES } from '../constants';
import { queryInterceptor } from '../utils/queryInterceptor';

export interface PaginationRequest extends Request {
  pagination: {
    page: number;
    limit: number;
    offset: number;
  };
}

/**
 * Middleware to validate and normalize pagination parameters
 */
export function enforcePagination(
  req: PaginationRequest,
  res: Response,
  next: NextFunction
): void | Response {
  try {
    const page = parseInt(req.query.page as string) || DEFAULT_VALUES.DEFAULT_PAGE;
    const limit = parseInt(req.query.limit as string) || DEFAULT_VALUES.DEFAULT_LIMIT;

    // Validate pagination parameters
    const validation = queryInterceptor.validatePaginationParams({ page, limit });

    if (validation.errors.length > 0) {
      logger.warn('Pagination validation failed:', {
        originalParams: { page: req.query.page, limit: req.query.limit },
        errors: validation.errors,
        correctedParams: { page: validation.page, limit: validation.limit }
      });

      return res.status(400).json({
        error: {
          code: 'INVALID_PAGINATION',
          message: 'Invalid pagination parameters',
          details: validation.errors,
          corrected: {
            page: validation.page,
            limit: validation.limit
          }
        }
      });
    }

    // Add validated pagination to request
    req.pagination = {
      page: validation.page,
      limit: validation.limit,
      offset: (validation.page - 1) * validation.limit
    };

    logger.debug('Pagination enforced:', req.pagination);
    next();
  } catch (error) {
    logger.error('Error in pagination enforcement middleware:', error);
    res.status(500).json({
      error: {
        code: 'PAGINATION_ERROR',
        message: 'Failed to process pagination parameters'
      }
    });
  }
}

/**
 * Middleware to warn about endpoints that should use pagination
 */
export function warnUnpaginatedEndpoint(
  endpointName: string,
  expectedMaxRecords: number = 100
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const hasPageParam = req.query.page !== undefined;
    const hasLimitParam = req.query.limit !== undefined;

    if (!hasPageParam && !hasLimitParam) {
      logger.warn(`Unpaginated endpoint accessed: ${endpointName}`, {
        url: req.originalUrl,
        method: req.method,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        expectedMaxRecords,
        suggestion: 'Consider adding pagination parameters: ?page=1&limit=20'
      });

      // Add warning header
      res.set('X-Pagination-Warning', 'This endpoint should use pagination for better performance');
    }

    next();
  };
}

/**
 * Middleware to enforce pagination on specific routes
 */
export function requirePagination(
  req: Request,
  res: Response,
  next: NextFunction
): void | Response {
  const hasPageParam = req.query.page !== undefined;
  const hasLimitParam = req.query.limit !== undefined;

  if (!hasPageParam && !hasLimitParam) {
    return res.status(400).json({
      error: {
        code: 'PAGINATION_REQUIRED',
        message: 'This endpoint requires pagination parameters',
        example: `${req.originalUrl}?page=1&limit=20`,
        documentation: 'Add page and limit query parameters to paginate results'
      }
    });
  }

  // Apply standard pagination enforcement
  enforcePagination(req as PaginationRequest, res, next);
}

/**
 * Response helper to format paginated results consistently
 */
export function formatPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
  additionalMeta: Record<string, any> = {}
): {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  meta: Record<string, any>;
} {
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext,
      hasPrev
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...additionalMeta
    }
  };
}

/**
 * Utility to extract pagination from request
 */
export function extractPagination(req: Request): {
  page: number;
  limit: number;
  offset: number;
} {
  const page = Math.max(1, parseInt(req.query.page as string) || DEFAULT_VALUES.DEFAULT_PAGE);
  const limit = Math.min(
    Math.max(1, parseInt(req.query.limit as string) || DEFAULT_VALUES.DEFAULT_LIMIT),
    DEFAULT_VALUES.MAX_QUERY_LIMIT
  );
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Decorator for controller methods to enforce pagination
 */
export function PaginationRequired(target: any, propertyName: string, descriptor: PropertyDescriptor): void {
  const method = descriptor.value;

  descriptor.value = async function (req: Request, res: Response, next: NextFunction): Promise<any> {
    // Check if pagination parameters are present
    const hasPageParam = req.query.page !== undefined;
    const hasLimitParam = req.query.limit !== undefined;

    if (!hasPageParam && !hasLimitParam) {
      logger.warn(`Pagination required for ${target.constructor.name}.${propertyName}`, {
        url: req.originalUrl,
        method: req.method
      });

      return res.status(400).json({
        error: {
          code: 'PAGINATION_REQUIRED',
          message: `Method ${propertyName} requires pagination parameters`,
          example: `${req.originalUrl}?page=1&limit=20`
        }
      });
    }

    // Apply pagination enforcement
    const paginationReq = req as PaginationRequest;
    return enforcePagination(paginationReq, res, () => {
      return method.call(this, paginationReq, res, next);
    });
  };
}

/**
 * Global query monitoring for development
 */
export function enableQueryMonitoring(): void {
  if (process.env.NODE_ENV === 'development') {
    setInterval(() => {
      const stats = queryInterceptor.getStats();
      if (stats.totalQueries > 0) {
        logger.info('Query monitoring stats:', {
          totalQueries: stats.totalQueries,
          largeQueries: stats.largeQueries,
          riskPercentage: stats.riskPercentage.toFixed(2) + '%'
        });

        if (stats.riskPercentage > 20) {
          logger.warn('High percentage of risky queries detected. Consider adding pagination.');
        }
      }
    }, 60000); // Log every minute
  }
}