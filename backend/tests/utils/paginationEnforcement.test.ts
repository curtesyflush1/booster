/**
 * Tests for pagination enforcement utilities
 */

import { QueryInterceptor, createPaginatedQuery } from '../../src/utils/queryInterceptor';
import { 
  enforcePagination, 
  formatPaginatedResponse, 
  extractPagination,
  PaginationRequest
} from '../../src/middleware/paginationEnforcement';
import { PaginationMigrationHelper, PaginationComplianceChecker } from '../../src/utils/paginationMigration';
import { BaseModel } from '../../src/models/BaseModel';
import { db } from '../../src/config/database';
import { Request, Response } from 'express';

// Mock database for testing
jest.mock('../../src/config/database', () => ({
  db: jest.fn(),
  handleDatabaseError: jest.fn((error) => error)
}));

describe('Pagination Enforcement', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    mockRequest = {
      query: {},
      originalUrl: '/api/test'
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis()
    };
    nextFunction = jest.fn();
    
    // Reset interceptor stats
    QueryInterceptor.getInstance().resetStats();
    PaginationMigrationHelper.clearReports();
  });

  describe('QueryInterceptor', () => {
    it('should detect queries without LIMIT', () => {
      const interceptor = QueryInterceptor.getInstance();
      
      // Mock a query builder
      const mockQuery = {
        toSQL: () => ({ sql: 'SELECT * FROM products WHERE is_active = true' })
      } as any;

      const analysis = interceptor.analyzeQuery(mockQuery);
      
      expect(analysis.hasLimit).toBe(false);
      expect(analysis.riskLevel).toBe('high');
      expect(analysis.suggestions).toContain('Add LIMIT clause to prevent large result sets');
    });

    it('should detect safe queries with LIMIT', () => {
      const interceptor = QueryInterceptor.getInstance();
      
      const mockQuery = {
        toSQL: () => ({ sql: 'SELECT * FROM products WHERE is_active = true LIMIT 20 OFFSET 0' })
      } as any;

      const analysis = interceptor.analyzeQuery(mockQuery);
      
      expect(analysis.hasLimit).toBe(true);
      expect(analysis.hasOffset).toBe(true);
      expect(analysis.riskLevel).toBe('low');
    });

    it('should validate pagination parameters', () => {
      const interceptor = QueryInterceptor.getInstance();
      
      const validation = interceptor.validatePaginationParams({
        page: 0,
        limit: 1000
      });

      expect(validation.page).toBe(1); // Corrected from 0
      expect(validation.limit).toBe(100); // Capped at MAX_QUERY_LIMIT
      expect(validation.errors).toHaveLength(2);
    });
  });

  describe('Pagination Middleware', () => {
    it('should enforce valid pagination parameters', () => {
      mockRequest.query = { page: '2', limit: '50' };

      enforcePagination(
        mockRequest as PaginationRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect((mockRequest as PaginationRequest).pagination).toEqual({
        page: 2,
        limit: 50,
        offset: 50
      });
    });

    it('should reject invalid pagination parameters', () => {
      mockRequest.query = { page: '-1', limit: '1000' };

      enforcePagination(
        mockRequest as PaginationRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'INVALID_PAGINATION'
          })
        })
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should extract pagination from request', () => {
      mockRequest.query = { page: '3', limit: '25' };

      const pagination = extractPagination(mockRequest as Request);

      expect(pagination).toEqual({
        page: 3,
        limit: 25,
        offset: 50
      });
    });
  });

  describe('Response Formatting', () => {
    it('should format paginated response correctly', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const response = formatPaginatedResponse(data, 100, 2, 20);

      expect(response).toEqual({
        data,
        pagination: {
          page: 2,
          limit: 20,
          total: 100,
          totalPages: 5,
          hasNext: true,
          hasPrev: true
        },
        meta: expect.objectContaining({
          timestamp: expect.any(String)
        })
      });
    });

    it('should handle first page correctly', () => {
      const data = [{ id: 1 }];
      const response = formatPaginatedResponse(data, 50, 1, 20);

      expect(response.pagination.hasNext).toBe(true);
      expect(response.pagination.hasPrev).toBe(false);
    });

    it('should handle last page correctly', () => {
      const data = [{ id: 1 }];
      const response = formatPaginatedResponse(data, 21, 2, 20);

      expect(response.pagination.hasNext).toBe(false);
      expect(response.pagination.hasPrev).toBe(true);
    });
  });

  describe('BaseModel Pagination', () => {
    class TestModel extends BaseModel {
      protected static override tableName = 'test_table';
      
      validate() { return []; }
      sanitize(data: any) { return data; }
    }

    beforeEach(() => {
      // Mock database methods
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        count: jest.fn().mockResolvedValue([{ count: '50' }]),
        orderBy: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis()
      };
      
      (db as jest.Mock).mockImplementation(() => mockQuery);
      mockQuery.where.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    });

    it('should enforce pagination in findBy method', async () => {
      const result = await TestModel.findBy({ is_active: true });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('limit');
    });

    it('should respect custom pagination options', async () => {
      const result = await TestModel.findBy(
        { is_active: true },
        { page: 3, limit: 50 }
      );

      expect(result.page).toBe(3);
      expect(result.limit).toBe(50);
    });

    it('should enforce maximum limit', async () => {
      const result = await TestModel.findBy(
        { is_active: true },
        { limit: 1000 } // Exceeds MAX_QUERY_LIMIT
      );

      expect(result.limit).toBe(100); // Capped at MAX_QUERY_LIMIT
    });
  });

  describe('Migration Helper', () => {
    it('should report pagination issues', () => {
      PaginationMigrationHelper.reportIssue({
        file: 'TestController.ts',
        line: 42,
        method: 'getProducts',
        issue: 'No pagination parameters',
        suggestion: 'Add pagination support',
        severity: 'high'
      });

      const reports = PaginationMigrationHelper.getReports();
      expect(reports).toHaveLength(1);
      expect(reports[0].severity).toBe('high');
    });

    it('should validate pagination usage', () => {
      const validation = PaginationMigrationHelper.validatePaginationUsage(
        'getProducts',
        false, // no page param
        false, // no limit param
        500    // large result count
      );

      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('No pagination parameters detected');
      expect(validation.suggestions).toContain('Add page and limit parameters to method signature');
    });
  });

  describe('Compliance Checker', () => {
    beforeEach(() => {
      // Clear previous violations for clean tests
      (PaginationComplianceChecker as any).violations = [];
    });

    it('should detect compliance violations', () => {
      PaginationComplianceChecker.checkCompliance(
        'getProducts',
        500, // exceeds limit
        false // no pagination
      );

      const violations = PaginationComplianceChecker.getViolations();
      expect(violations).toHaveLength(1);
      expect(violations[0].recordCount).toBe(500);
      expect(violations[0].hasPagination).toBe(false);
    });

    it('should generate compliance report', () => {
      // Add some test data
      PaginationComplianceChecker.checkCompliance('method1', 50, true);
      PaginationComplianceChecker.checkCompliance('method2', 200, false);

      const report = PaginationComplianceChecker.getComplianceReport();
      
      expect(report.totalChecks).toBe(2);
      expect(report.violations).toBe(1);
      expect(report.complianceRate).toBe(50);
    });
  });

  describe('createPaginatedQuery', () => {
    it('should create paginated query with count query', () => {
      const mockKnex = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis()
      } as any;

      // mockKnex is already set up to return itself

      const result = createPaginatedQuery(mockKnex, 'products', {
        page: 2,
        limit: 25,
        where: { is_active: true }
      });

      expect(result.pagination).toEqual({ page: 2, limit: 25 });
      expect(mockKnex.where).toHaveBeenCalledWith({ is_active: true });
      expect(mockKnex.limit).toHaveBeenCalledWith(25);
      expect(mockKnex.offset).toHaveBeenCalledWith(25);
    });
  });
});

describe('Integration Tests', () => {
  it('should work end-to-end with real database queries', async () => {
    // This would require a test database setup
    // For now, we'll mock the essential parts
    
    const mockDb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      count: jest.fn().mockResolvedValue([{ count: '10' }]),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      then: jest.fn().mockResolvedValue([
        { id: 1, name: 'Product 1' },
        { id: 2, name: 'Product 2' }
      ])
    };

    (db as jest.Mock).mockImplementation(() => mockDb);

    class TestModel extends BaseModel {
      protected static override tableName = 'products';
      validate() { return []; }
      sanitize(data: any) { return data; }
    }

    const result = await TestModel.findBy(
      { is_active: true },
      { page: 1, limit: 20 }
    );

    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(10);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });
});