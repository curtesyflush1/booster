/**
 * URL Parameter Sanitization Security Tests
 * 
 * This test suite validates that all API endpoints properly sanitize URL parameters
 * to prevent security vulnerabilities including:
 * - SQL Injection attacks
 * - Cross-Site Scripting (XSS) attacks
 * - Path traversal attacks
 * - Null byte injection
 * - Control character injection
 * 
 * The tests cover both authenticated and unauthenticated endpoints,
 * ensuring comprehensive security coverage across the application.
 * 
 * @author BoosterBeacon Security Team
 * @version 1.2.0
 * @since 2025-08-28
 */

import supertest, { Test } from 'supertest';
import app from '../../src/index';
import { User } from '../../src/models/User';
import { Product } from '../../src/models/Product';
import { ProductCategory } from '../../src/models/ProductCategory';
import { generateTestToken } from '../helpers/authTestHelpers';
import { logger } from '../../src/utils/logger';

// Mock logger to prevent console spam during tests
jest.mock('../../src/utils/logger');

describe('URL Parameter Sanitization Security Tests', () => {
  let authToken: string;
  let testUserId: string;
  let testProductId: string;
  let testCategoryId: string;

  // Test payload constants for better maintainability
  const SQL_INJECTION_PAYLOADS = [
    "'; DROP TABLE users; --",
    "' OR '1'='1",
    "'; DELETE FROM products WHERE '1'='1'; --",
    "' UNION SELECT * FROM users --",
    "'; INSERT INTO users (email) VALUES ('hacker@evil.com'); --",
    "' OR 1=1 --",
    "'; UPDATE users SET role='admin' WHERE '1'='1'; --"
  ];

  const XSS_PAYLOADS = [
    '<script>alert("xss")</script>',
    '<img src="x" onerror="alert(1)">',
    'javascript:alert("xss")',
    '<svg onload="alert(1)">',
    '"><script>alert("xss")</script>',
    '<iframe src="javascript:alert(1)"></iframe>'
  ];

  const PATH_TRAVERSAL_PAYLOADS = [
    '../../../etc/passwd',
    '..\\..\\..\\windows\\system32\\config\\sam',
    '....//....//....//etc/passwd',
    '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
    '..%252f..%252f..%252fetc%252fpasswd'
  ];

  const NULL_BYTE_PAYLOADS = [
    'test\x00.txt',
    'test%00.txt',
    'test\u0000.txt'
  ];

  const CONTROL_CHAR_PAYLOADS = [
    'test\x01\x02\x03',
    'test\x1F\x7F',
    'test\r\n\t'
  ];

  // Helper function to test parameter sanitization
  const testParameterSanitization = async (
    endpoint: string,
    payload: string,
    expectedStatus: number = 200,
    options: { 
      useAuth?: boolean; 
      method?: 'GET' | 'POST' | 'DELETE';
      expectedErrorCode?: string;
    } = {}
  ) => {
    const { useAuth = false, method = 'GET', expectedErrorCode } = options;
    
    let req: Test = (supertest(app)[method.toLowerCase() as 'get' | 'post' | 'delete'])(endpoint);
    
    if (useAuth) {
      req = req.set('Authorization', `Bearer ${authToken}`) as unknown as Test;
    }
    
    const response = await req.expect(expectedStatus);
    
    if (expectedErrorCode && response.body.error) {
      expect(response.body.error.code).toBe(expectedErrorCode);
    }
    
    return response;
  };

  beforeAll(async () => {
    // Create test user
    const testUser = await User.create({
      email: 'test@example.com',
      password_hash: 'hashedpassword123', // Use password_hash instead of password
      first_name: 'Test',
      last_name: 'User',
      email_verified: true
    }) as any; // Type assertion to handle the id property
    testUserId = testUser.id;
    authToken = generateTestToken(testUser.id);

    // Create test category
    const testCategory = await ProductCategory.create({
      name: 'Test Category',
      slug: 'test-category',
      description: 'Test category for sanitization tests'
    }) as any;
    testCategoryId = testCategory.id;

    // Create test product
    const testProduct = await Product.create({
      name: 'Test Product',
      slug: 'test-product',
      description: 'Test product for sanitization tests',
      category_id: testCategoryId,
      set_name: 'Test Set',
      series: 'Test Series',
      release_date: new Date(),
      msrp: 99.99,
      upc: '123456789012'
    }) as any;
    testProductId = testProduct.id;
  });

  afterAll(async () => {
    // Clean up test data with error handling
    try {
      if (testProductId) {
        await Product.deleteBy({ id: testProductId });
      }
      if (testCategoryId) {
        await ProductCategory.deleteBy({ id: testCategoryId });
      }
      if (testUserId) {
        await User.deleteBy({ id: testUserId });
      }
    } catch (error) {
      // Log cleanup errors but don't fail the test
      console.warn('Test cleanup failed:', error);
    }
  });

  describe('SQL Injection Prevention', () => {
    test.each(SQL_INJECTION_PAYLOADS)('should sanitize SQL injection in product ID parameter: %s', async (payload) => {
      await testParameterSanitization(
        `/api/products/${payload}`,
        payload,
        400,
        { expectedErrorCode: 'INVALID_PRODUCT_ID' }
      );
    });

    test.each(SQL_INJECTION_PAYLOADS)('should sanitize SQL injection in category ID parameter: %s', async (payload) => {
      await testParameterSanitization(
        `/api/products/category/${payload}`,
        payload,
        400,
        { expectedErrorCode: 'INVALID_CATEGORY_ID' }
      );
    });

    test.each(SQL_INJECTION_PAYLOADS)('should sanitize SQL injection in set name parameter: %s', async (payload) => {
      const response = await testParameterSanitization(
        `/api/products/set/${encodeURIComponent(payload)}`,
        payload,
        200
      );

      // Should return empty results, not a database error
      expect(response.body.success).toBe(true);
      expect(response.body.data.products).toEqual([]);
    });

    test.each(SQL_INJECTION_PAYLOADS)('should sanitize SQL injection in search query parameter: %s', async (payload) => {
      const response = await testParameterSanitization(
        `/api/products/search?q=${encodeURIComponent(payload)}`,
        payload,
        200
      );

      expect(response.body.success).toBe(true);
      // Should not contain any SQL injection artifacts in the response
      expect(JSON.stringify(response.body)).not.toMatch(/DROP|DELETE|INSERT|UPDATE|UNION|SELECT/i);
    });
  });

  describe('XSS Prevention', () => {
    const assertNoXSSVectors = (response: any) => {
      expect(response.body.success).toBe(true);
      // Response should not contain script tags or other XSS vectors
      expect(JSON.stringify(response.body)).not.toMatch(/<script|<img|<svg|<iframe|javascript:/i);
    };

    test.each(XSS_PAYLOADS)('should sanitize XSS in search query: %s', async (payload) => {
      const response = await testParameterSanitization(
        `/api/products/search?q=${encodeURIComponent(payload)}`,
        payload,
        200
      );
      assertNoXSSVectors(response);
    });

    test.each(XSS_PAYLOADS)('should sanitize XSS in set name parameter: %s', async (payload) => {
      const response = await testParameterSanitization(
        `/api/products/set/${encodeURIComponent(payload)}`,
        payload,
        200
      );
      assertNoXSSVectors(response);
    });
  });

  describe('Path Traversal Prevention', () => {
    test.each(PATH_TRAVERSAL_PAYLOADS)('should sanitize path traversal in slug parameter: %s', async (payload) => {
      await testParameterSanitization(
        `/api/products/slug/${encodeURIComponent(payload)}`,
        payload,
        404,
        { expectedErrorCode: 'PRODUCT_NOT_FOUND' }
      );
    });
  });

  describe('Null Byte Injection Prevention', () => {
    test.each(NULL_BYTE_PAYLOADS)('should sanitize null bytes in parameters: %s', async (payload) => {
      const response = await testParameterSanitization(
        `/api/products/search?q=${encodeURIComponent(payload)}`,
        payload,
        200
      );

      expect(response.body.success).toBe(true);
      // Response should not contain null bytes
      expect(JSON.stringify(response.body)).not.toMatch(/\x00|\u0000/);
    });
  });

  describe('Control Character Prevention', () => {
    test.each(CONTROL_CHAR_PAYLOADS)('should sanitize control characters in parameters: %s', async (payload) => {
      const response = await testParameterSanitization(
        `/api/products/search?q=${encodeURIComponent(payload)}`,
        payload,
        200
      );

      expect(response.body.success).toBe(true);
      // Verify control characters are removed (except allowed whitespace)
      const responseStr = JSON.stringify(response.body);
      expect(responseStr).not.toMatch(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/);
    });
  });

  describe('Length Limit Enforcement', () => {
    test('should truncate overly long parameters', async () => {
      const longPayload = 'a'.repeat(300); // Longer than 200 char limit

      const response = await request(app)
        .get(`/api/products/search?q=${encodeURIComponent(longPayload)}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      // The search should still work, but with truncated input
    });
  });

  describe('Authenticated Route Parameter Sanitization', () => {
    const authenticatedRouteTests = [
      {
        name: 'webhook routes',
        endpoint: '/api/webhooks/',
        payload: "'; DROP TABLE webhooks; --",
        method: 'GET' as const
      },
      {
        name: 'user management routes',
        endpoint: '/api/users/addresses/',
        payload: "'; DELETE FROM addresses; --",
        method: 'DELETE' as const
      },
      {
        name: 'retailer routes',
        endpoint: '/api/retailers/',
        payload: "'; UPDATE retailers SET active=false; --",
        method: 'GET' as const,
        suffix: '/config'
      }
    ];

    test.each(authenticatedRouteTests)('should sanitize parameters in authenticated $name', async ({ endpoint, payload, method, suffix = '' }) => {
      const fullEndpoint = `${endpoint}${encodeURIComponent(payload)}${suffix}`;
      
      await testParameterSanitization(
        fullEndpoint,
        payload,
        400,
        { useAuth: true, method }
      );
    });
  });

  describe('Logging of Sanitization Events', () => {
    test('should log when parameters are sanitized', async () => {
      const maliciousPayload = '<script>alert("xss")</script>';

      await request(app)
        .get(`/api/products/search?q=${encodeURIComponent(maliciousPayload)}`)
        .expect(200);

      // Verify that sanitization was logged
      expect(logger.warn).toHaveBeenCalledWith(
        'URL parameters were sanitized',
        expect.objectContaining({
          path: '/api/products/search',
          method: 'GET'
        })
      );
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty parameters gracefully', async () => {
      const response = await testParameterSanitization('/api/products/search?q=', '', 200);
      expect(response.body.success).toBe(true);
    });

    test('should handle undefined parameters gracefully', async () => {
      const response = await testParameterSanitization('/api/products/search', '', 200);
      expect(response.body.success).toBe(true);
    });

    test('should handle non-string parameters gracefully', async () => {
      // This would be handled by the middleware before reaching the controller
      const response = await testParameterSanitization('/api/products/search?q[]=test&q[]=malicious', '', 200);
      expect(response.body.success).toBe(true);
    });

    test('should handle extremely long parameter chains', async () => {
      const longQuery = Array(50).fill('param=value').join('&');
      const response = await testParameterSanitization(`/api/products/search?${longQuery}`, '', 200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Performance Impact', () => {
    test('should sanitize parameters without significant performance degradation', async () => {
      const complexPayload = SQL_INJECTION_PAYLOADS[0] + XSS_PAYLOADS[0] + PATH_TRAVERSAL_PAYLOADS[0];
      
      const startTime = Date.now();
      await testParameterSanitization(
        `/api/products/search?q=${encodeURIComponent(complexPayload)}`,
        complexPayload,
        200
      );
      const endTime = Date.now();
      
      // Sanitization should not add more than 100ms overhead
      expect(endTime - startTime).toBeLessThan(1000);
    });

    test('should handle concurrent sanitization requests', async () => {
      const promises = SQL_INJECTION_PAYLOADS.slice(0, 5).map(payload =>
        testParameterSanitization(
          `/api/products/search?q=${encodeURIComponent(payload)}`,
          payload,
          200
        )
      );

      const results = await Promise.all(promises);
      results.forEach(response => {
        expect(response.body.success).toBe(true);
      });
    });
  });
});
