/**
 * Pagination Migration Utilities
 * 
 * Helps identify and migrate existing code to use proper pagination
 */

import { logger } from './logger';
import { DEFAULT_VALUES } from '../constants';

export interface MigrationReport {
  file: string;
  line: number;
  method: string;
  issue: string;
  suggestion: string;
  severity: 'low' | 'medium' | 'high';
}

export class PaginationMigrationHelper {
  private static reports: MigrationReport[] = [];

  /**
   * Report a pagination issue found in code
   */
  static reportIssue(report: MigrationReport): void {
    this.reports.push(report);
    
    const logLevel = report.severity === 'high' ? 'error' : 
                    report.severity === 'medium' ? 'warn' : 'info';
    
    logger[logLevel]('Pagination issue detected:', report);
  }

  /**
   * Get all reported pagination issues
   */
  static getReports(): MigrationReport[] {
    return [...this.reports];
  }

  /**
   * Clear all reports (useful for testing)
   */
  static clearReports(): void {
    this.reports = [];
  }

  /**
   * Generate migration suggestions for common patterns
   */
  static generateMigrationSuggestions(): {
    patterns: Array<{
      pattern: string;
      issue: string;
      before: string;
      after: string;
    }>;
  } {
    return {
      patterns: [
        {
          pattern: 'Model.findBy(criteria)',
          issue: 'Returns all matching records without pagination',
          before: `const users = await User.findBy({ is_active: true });`,
          after: `const result = await User.findBy({ is_active: true }, { page: 1, limit: 20 });
const users = result.data;`
        },
        {
          pattern: 'knex.select().where()',
          issue: 'Direct Knex queries without LIMIT',
          before: `const products = await knex('products').select('*').where('is_active', true);`,
          after: `const { query, countQuery, pagination } = createPaginatedQuery(knex, 'products', {
  where: { is_active: true },
  page: req.pagination.page,
  limit: req.pagination.limit
});
const products = await query;
const totalResult = await countQuery;`
        },
        {
          pattern: 'Controller without pagination',
          issue: 'API endpoints returning unpaginated results',
          before: `async getProducts(req: Request, res: Response) {
  const products = await Product.findBy({ is_active: true });
  res.json(products);
}`,
          after: `async getProducts(req: PaginationRequest, res: Response) {
  const result = await Product.findBy({ is_active: true }, req.pagination);
  res.json(formatPaginatedResponse(result.data, result.total, result.page, result.limit));
}`
        }
      ]
    };
  }

  /**
   * Validate that a method uses proper pagination
   */
  static validatePaginationUsage(
    methodName: string,
    hasPageParam: boolean,
    hasLimitParam: boolean,
    resultCount?: number
  ): {
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];

    if (!hasPageParam && !hasLimitParam) {
      issues.push('No pagination parameters detected');
      suggestions.push('Add page and limit parameters to method signature');
    }

    if (resultCount && resultCount > DEFAULT_VALUES.MAX_QUERY_LIMIT) {
      issues.push(`Method returned ${resultCount} records, exceeding safe limit`);
      suggestions.push('Implement pagination to handle large result sets');
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions
    };
  }
}

/**
 * Decorator to mark methods that need pagination migration
 */
export function NeedsPaginationMigration(
  issue: string,
  severity: 'low' | 'medium' | 'high' = 'medium'
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      // Report the issue
      PaginationMigrationHelper.reportIssue({
        file: target.constructor.name,
        line: 0, // Would need source map for actual line numbers
        method: propertyName,
        issue,
        suggestion: 'Migrate this method to use pagination',
        severity
      });

      // Call original method
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Runtime checker for pagination compliance
 */
export class PaginationComplianceChecker {
  private static violations: Array<{
    timestamp: Date;
    method: string;
    recordCount: number;
    hasPagination: boolean;
  }> = [];

  static checkCompliance(
    methodName: string,
    recordCount: number,
    hasPagination: boolean
  ): void {
    const isViolation = recordCount > DEFAULT_VALUES.MAX_QUERY_LIMIT && !hasPagination;

    if (isViolation) {
      this.violations.push({
        timestamp: new Date(),
        method: methodName,
        recordCount,
        hasPagination
      });

      logger.warn('Pagination compliance violation:', {
        method: methodName,
        recordCount,
        hasPagination,
        threshold: DEFAULT_VALUES.MAX_QUERY_LIMIT
      });
    }
  }

  static getViolations(): typeof PaginationComplianceChecker.violations {
    return [...this.violations];
  }

  static getComplianceReport(): {
    totalChecks: number;
    violations: number;
    complianceRate: number;
    recentViolations: typeof PaginationComplianceChecker.violations;
  } {
    const totalChecks = this.violations.length;
    const violations = this.violations.filter(v => !v.hasPagination).length;
    const complianceRate = totalChecks > 0 ? ((totalChecks - violations) / totalChecks) * 100 : 100;
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentViolations = this.violations.filter(v => v.timestamp > oneDayAgo);

    return {
      totalChecks,
      violations,
      complianceRate,
      recentViolations
    };
  }
}

/**
 * Helper to wrap existing methods with pagination compliance checking
 */
export function wrapWithComplianceCheck<T extends (...args: any[]) => Promise<any[]>>(
  method: T,
  methodName: string
): T {
  return (async (...args: any[]) => {
    const result = await method(...args);
    const recordCount = Array.isArray(result) ? result.length : 0;
    
    // Check if method signature suggests pagination support
    const hasPagination = args.some(arg => 
      arg && typeof arg === 'object' && ('page' in arg || 'limit' in arg)
    );

    PaginationComplianceChecker.checkCompliance(methodName, recordCount, hasPagination);
    
    return result;
  }) as T;
}

/**
 * Utility to convert legacy findBy calls to paginated versions
 */
export function convertToPaginatedCall(
  originalCall: string,
  defaultPage: number = 1,
  defaultLimit: number = DEFAULT_VALUES.DEFAULT_LIMIT
): string {
  // Simple regex-based conversion for common patterns
  const patterns = [
    {
      regex: /(\w+)\.findBy\(([^)]+)\)/g,
      replacement: `$1.findBy($2, { page: ${defaultPage}, limit: ${defaultLimit} })`
    },
    {
      regex: /(\w+)\.findAll\(\)/g,
      replacement: `$1.findAll({ page: ${defaultPage}, limit: ${defaultLimit} })`
    }
  ];

  let converted = originalCall;
  patterns.forEach(pattern => {
    converted = converted.replace(pattern.regex, pattern.replacement);
  });

  return converted;
}

// Export singleton instances
export const migrationHelper = PaginationMigrationHelper;
export const complianceChecker = PaginationComplianceChecker;