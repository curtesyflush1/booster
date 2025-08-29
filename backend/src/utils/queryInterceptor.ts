/**
 * Database Query Interceptor
 * 
 * Provides utilities to monitor and enforce pagination on database queries
 * to prevent performance degradation with large datasets.
 */

import { Knex } from 'knex';
import { logger } from './logger';
import { DEFAULT_VALUES } from '../constants';

export interface QueryAnalysis {
  hasLimit: boolean;
  hasOffset: boolean;
  estimatedRows?: number;
  riskLevel: 'low' | 'medium' | 'high';
  suggestions: string[];
}

export class QueryInterceptor {
  private static instance: QueryInterceptor;
  private queryCount = 0;
  private largeQueryCount = 0;

  static getInstance(): QueryInterceptor {
    if (!QueryInterceptor.instance) {
      QueryInterceptor.instance = new QueryInterceptor();
    }
    return QueryInterceptor.instance;
  }

  /**
   * Analyze a Knex query to detect potential performance issues
   */
  analyzeQuery(query: Knex.QueryBuilder): QueryAnalysis {
    const sql = query.toSQL();
    const queryString = sql.sql.toLowerCase();
    
    const hasLimit = queryString.includes('limit');
    const hasOffset = queryString.includes('offset');
    const hasJoins = queryString.includes('join');
    const hasSubqueries = queryString.includes('select') && queryString.split('select').length > 2;
    
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    const suggestions: string[] = [];

    // Analyze risk factors
    if (!hasLimit) {
      riskLevel = 'high';
      suggestions.push('Add LIMIT clause to prevent large result sets');
    }

    if (hasJoins && !hasLimit) {
      riskLevel = 'high';
      suggestions.push('JOINs without LIMIT can cause exponential result growth');
    }

    if (hasSubqueries && !hasLimit) {
      riskLevel = 'medium';
      suggestions.push('Subqueries should use LIMIT to control result size');
    }

    if (!hasOffset && hasLimit) {
      suggestions.push('Consider adding OFFSET for proper pagination');
    }

    return {
      hasLimit,
      hasOffset,
      riskLevel,
      suggestions
    };
  }

  /**
   * Wrap a Knex query to add automatic pagination if missing
   */
  wrapQuery<T>(
    query: Knex.QueryBuilder,
    options: {
      defaultLimit?: number;
      maxLimit?: number;
      enforceLimit?: boolean;
      context?: string;
    } = {}
  ): Knex.QueryBuilder {
    const {
      defaultLimit = DEFAULT_VALUES.DEFAULT_LIMIT,
      maxLimit = DEFAULT_VALUES.MAX_QUERY_LIMIT,
      enforceLimit = true,
      context = 'Unknown'
    } = options;

    const analysis = this.analyzeQuery(query);
    
    // Log high-risk queries
    if (analysis.riskLevel === 'high') {
      this.largeQueryCount++;
      logger.warn('High-risk database query detected:', {
        context,
        sql: query.toSQL().sql,
        suggestions: analysis.suggestions,
        queryCount: this.queryCount,
        largeQueryCount: this.largeQueryCount
      });
    }

    // Auto-add limit if missing and enforcement is enabled
    if (!analysis.hasLimit && enforceLimit) {
      logger.info(`Auto-adding LIMIT ${defaultLimit} to query in ${context}`);
      query = query.limit(defaultLimit);
    }

    this.queryCount++;
    return query;
  }

  /**
   * Create a safe query builder that enforces pagination
   */
  createSafeQuery(
    knex: Knex,
    tableName: string,
    options: {
      page?: number;
      limit?: number;
      maxLimit?: number;
      context?: string;
    } = {}
  ): Knex.QueryBuilder {
    const {
      page = DEFAULT_VALUES.DEFAULT_PAGE,
      limit = DEFAULT_VALUES.DEFAULT_LIMIT,
      maxLimit = DEFAULT_VALUES.MAX_QUERY_LIMIT,
      context = 'SafeQuery'
    } = options;

    const safeLimit = Math.min(limit, maxLimit);
    const offset = (page - 1) * safeLimit;

    const query = knex(tableName)
      .limit(safeLimit)
      .offset(offset);

    logger.debug(`Created safe query for ${tableName}:`, {
      context,
      page,
      limit: safeLimit,
      offset
    });

    return query;
  }

  /**
   * Validate query parameters for pagination
   */
  validatePaginationParams(params: {
    page?: number;
    limit?: number;
  }): {
    page: number;
    limit: number;
    errors: string[];
  } {
    const errors: string[] = [];
    let { page = DEFAULT_VALUES.DEFAULT_PAGE, limit = DEFAULT_VALUES.DEFAULT_LIMIT } = params;

    // Validate page
    if (page < 1) {
      errors.push('Page must be greater than 0');
      page = DEFAULT_VALUES.DEFAULT_PAGE;
    }

    if (page > 10000) { // Reasonable upper bound
      errors.push('Page number too large (max 10000)');
      page = 10000;
    }

    // Validate limit
    if (limit < 1) {
      errors.push('Limit must be greater than 0');
      limit = DEFAULT_VALUES.DEFAULT_LIMIT;
    }

    if (limit > DEFAULT_VALUES.MAX_QUERY_LIMIT) {
      errors.push(`Limit exceeds maximum of ${DEFAULT_VALUES.MAX_QUERY_LIMIT}`);
      limit = DEFAULT_VALUES.MAX_QUERY_LIMIT;
    }

    return { page, limit, errors };
  }

  /**
   * Get statistics about query patterns
   */
  getStats(): {
    totalQueries: number;
    largeQueries: number;
    riskPercentage: number;
  } {
    return {
      totalQueries: this.queryCount,
      largeQueries: this.largeQueryCount,
      riskPercentage: this.queryCount > 0 ? (this.largeQueryCount / this.queryCount) * 100 : 0
    };
  }

  /**
   * Reset statistics (useful for testing)
   */
  resetStats(): void {
    this.queryCount = 0;
    this.largeQueryCount = 0;
  }
}

/**
 * Utility function to create paginated queries with safety checks
 */
export function createPaginatedQuery<T>(
  knex: Knex,
  tableName: string,
  options: {
    page?: number;
    limit?: number;
    where?: Record<string, any>;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    context?: string;
  } = {}
): {
  query: Knex.QueryBuilder;
  countQuery: Knex.QueryBuilder;
  pagination: { page: number; limit: number };
} {
  const interceptor = QueryInterceptor.getInstance();
  const validation = interceptor.validatePaginationParams(options);
  
  if (validation.errors.length > 0) {
    logger.warn('Pagination parameter validation errors:', validation.errors);
  }

  const {
    where = {},
    orderBy = 'created_at',
    orderDirection = 'desc',
    context = 'PaginatedQuery'
  } = options;

  const { page, limit } = validation;
  const offset = (page - 1) * limit;

  // Create main query
  let query = knex(tableName)
    .where(where)
    .orderBy(orderBy, orderDirection)
    .limit(limit)
    .offset(offset);

  // Create count query
  let countQuery = knex(tableName)
    .where(where)
    .count('* as count');

  // Wrap queries for monitoring
  query = interceptor.wrapQuery(query, { context: `${context}-main`, enforceLimit: false });
  countQuery = interceptor.wrapQuery(countQuery, { context: `${context}-count`, enforceLimit: false });

  return {
    query,
    countQuery,
    pagination: { page, limit }
  };
}

/**
 * Middleware to enforce pagination on Express routes
 */
export function paginationMiddleware(
  req: any,
  res: any,
  next: any
): void {
  const interceptor = QueryInterceptor.getInstance();
  const validation = interceptor.validatePaginationParams({
    page: req.query.page ? parseInt(req.query.page) : undefined,
    limit: req.query.limit ? parseInt(req.query.limit) : undefined
  });

  if (validation.errors.length > 0) {
    return res.status(400).json({
      error: 'Invalid pagination parameters',
      details: validation.errors
    });
  }

  // Add validated pagination to request
  req.pagination = {
    page: validation.page,
    limit: validation.limit
  };

  next();
}

// Export singleton instance
export const queryInterceptor = QueryInterceptor.getInstance();