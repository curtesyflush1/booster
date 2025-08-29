import { sanitizeParameters } from '../../src/middleware/parameterSanitization';
import { logger } from '../../src/utils/logger';

// Mock logger to prevent console spam during tests
jest.mock('../../src/utils/logger');

describe('Route Sanitization Coverage Tests', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      params: {},
      query: {},
      path: '/test',
      method: 'GET',
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('test-user-agent'),
      correlationId: 'test-correlation-id'
    };
    mockRes = {};
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('Critical Security Vulnerabilities Prevention', () => {
    test('should prevent SQL injection in all parameter types', () => {
      const sqlPayload = "'; DROP TABLE users; --";
      
      mockReq.params = {
        id: sqlPayload,
        userId: sqlPayload,
        productId: sqlPayload,
        categoryId: sqlPayload,
        retailerId: sqlPayload,
        webhookId: sqlPayload,
        serverId: sqlPayload,
        alertId: sqlPayload
      };

      mockReq.query = {
        q: sqlPayload,
        search: sqlPayload,
        upc: sqlPayload
      };

      sanitizeParameters(mockReq, mockRes, mockNext);

      // All UUID parameters should be empty after sanitization (invalid format)
      expect(mockReq.params.id).toBe('');
      expect(mockReq.params.userId).toBe('');
      expect(mockReq.params.productId).toBe('');
      expect(mockReq.params.categoryId).toBe('');
      expect(mockReq.params.retailerId).toBe('');
      expect(mockReq.params.webhookId).toBe('');
      expect(mockReq.params.serverId).toBe('');
      expect(mockReq.params.alertId).toBe('');

      // Query parameters should be sanitized but not empty
      expect(mockReq.query.q).not.toContain(';');
      expect(mockReq.query.q).not.toContain('--');
      expect(mockReq.query.search).not.toContain(';');
      expect(mockReq.query.search).not.toContain('--');
      expect(mockReq.query.upc).toBe(''); // UPC should be empty (invalid format)
    });

    test('should prevent XSS attacks in all parameter types', () => {
      const xssPayload = '<script>alert("xss")</script>';
      
      mockReq.params = {
        slug: xssPayload,
        setName: xssPayload
      };

      mockReq.query = {
        q: xssPayload,
        category_id: '123e4567-e89b-12d3-a456-426614174000' // Valid UUID
      };

      sanitizeParameters(mockReq, mockRes, mockNext);

      // Should remove script tags
      expect(mockReq.params.slug).not.toContain('<script');
      expect(mockReq.params.slug).not.toContain('</script>');
      expect(mockReq.params.setName).not.toContain('<script');
      expect(mockReq.params.setName).not.toContain('</script>');
      expect(mockReq.query.q).not.toContain('<script');
      expect(mockReq.query.q).not.toContain('</script>');
      
      // Valid UUID should remain unchanged
      expect(mockReq.query.category_id).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    test('should prevent path traversal attacks', () => {
      const pathTraversalPayload = '../../../etc/passwd';
      
      mockReq.params = {
        slug: pathTraversalPayload,
        filename: pathTraversalPayload
      };

      sanitizeParameters(mockReq, mockRes, mockNext);

      // Should remove path traversal sequences
      expect(mockReq.params.slug).not.toContain('../');
      expect(mockReq.params.filename).not.toContain('../');
    });

    test('should handle null byte injection', () => {
      const nullBytePayload = 'test\x00malicious';
      
      mockReq.params = {
        data: nullBytePayload
      };

      sanitizeParameters(mockReq, mockRes, mockNext);

      // Should remove null bytes
      expect(mockReq.params.data).not.toContain('\x00');
      expect(mockReq.params.data).toBe('testmalicious');
    });
  });

  describe('Parameter Type Specific Sanitization', () => {
    test('should properly sanitize UUID parameters', () => {
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';
      const invalidUUID = 'not-a-uuid';
      const maliciousUUID = "123e4567'; DROP TABLE users; --";
      
      mockReq.params = {
        id: validUUID,
        userId: invalidUUID,
        productId: maliciousUUID
      };

      sanitizeParameters(mockReq, mockRes, mockNext);

      // Valid UUID should remain unchanged
      expect(mockReq.params.id).toBe(validUUID);
      
      // Invalid UUID should be empty
      expect(mockReq.params.userId).toBe('');
      
      // Malicious UUID should be empty
      expect(mockReq.params.productId).toBe('');
    });

    test('should properly sanitize UPC parameters', () => {
      const validUPC = '123456789012';
      const invalidUPC = 'not-a-upc';
      const maliciousUPC = "123456789012'; DROP TABLE products; --";
      
      mockReq.query = {
        upc: validUPC,
        barcode: invalidUPC,
        malicious_upc: maliciousUPC
      };

      sanitizeParameters(mockReq, mockRes, mockNext);

      // Valid UPC should remain unchanged
      expect(mockReq.query.upc).toBe(validUPC);
      
      // Invalid UPC should be empty
      expect(mockReq.query.barcode).toBe('');
      
      // Malicious UPC should be sanitized to only digits
      expect(mockReq.query.malicious_upc).toBe('123456789012');
    });

    test('should properly sanitize search queries', () => {
      const validSearch = 'pokemon cards rare';
      const maliciousSearch = 'pokemon<script>alert("xss")</script>';
      
      mockReq.query = {
        q: validSearch,
        search: maliciousSearch
      };

      sanitizeParameters(mockReq, mockRes, mockNext);

      // Valid search should remain unchanged
      expect(mockReq.query.q).toBe(validSearch);
      
      // Malicious search should be sanitized
      expect(mockReq.query.search).not.toContain('<script');
      expect(mockReq.query.search).toContain('pokemon');
    });

    test('should properly sanitize set names', () => {
      const validSetName = 'Scarlet & Violet: Paldea Evolved';
      const maliciousSetName = "Scarlet & Violet<script>alert('xss')</script>";
      
      mockReq.params = {
        setName: maliciousSetName
      };

      sanitizeParameters(mockReq, mockRes, mockNext);

      // Should remove script tags but keep valid characters
      expect(mockReq.params.setName).toContain('Scarlet & Violet');
      expect(mockReq.params.setName).not.toContain('<script');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty and undefined parameters', () => {
      mockReq.params = {
        empty: '',
        undefined: undefined,
        null: null
      };

      sanitizeParameters(mockReq, mockRes, mockNext);

      expect(mockReq.params.empty).toBe('');
      expect(mockReq.params.undefined).toBeUndefined();
      expect(mockReq.params.null).toBeNull();
      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle non-string parameters', () => {
      mockReq.params = {
        number: 123,
        boolean: true,
        object: { test: 'value' }
      };

      sanitizeParameters(mockReq, mockRes, mockNext);

      // Non-string parameters should remain unchanged
      expect(mockReq.params.number).toBe(123);
      expect(mockReq.params.boolean).toBe(true);
      expect(mockReq.params.object).toEqual({ test: 'value' });
      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle array parameters', () => {
      mockReq.query = {
        tags: ['tag1', 'tag2<script>', 'tag3']
      };

      sanitizeParameters(mockReq, mockRes, mockNext);

      // Array elements should be sanitized
      expect(mockReq.query.tags[0]).toBe('tag1');
      expect(mockReq.query.tags[1]).not.toContain('<script');
      expect(mockReq.query.tags[2]).toBe('tag3');
      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle malformed requests gracefully', () => {
      const badReq = {
        params: null,
        query: null,
        path: '/test',
        method: 'GET'
      };

      sanitizeParameters(badReq as any, mockRes, mockNext);

      // Should not throw and should call next
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Logging and Monitoring', () => {
    test('should log sanitization events for security monitoring', () => {
      const maliciousPayload = '<script>alert("xss")</script>';
      
      mockReq.params = {
        test: maliciousPayload
      };

      sanitizeParameters(mockReq, mockRes, mockNext);

      // Should log the sanitization event
      expect(logger.warn).toHaveBeenCalledWith(
        'URL parameters were sanitized',
        expect.objectContaining({
          path: '/test',
          method: 'GET'
        })
      );
    });

    test('should not log when no sanitization is needed', () => {
      mockReq.params = {
        id: '123e4567-e89b-12d3-a456-426614174000'
      };

      sanitizeParameters(mockReq, mockRes, mockNext);

      // Should not log if nothing was changed
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('Performance and Length Limits', () => {
    test('should enforce length limits to prevent DoS attacks', () => {
      const longPayload = 'a'.repeat(300); // Longer than 200 char limit
      
      mockReq.query = {
        q: longPayload
      };

      sanitizeParameters(mockReq, mockRes, mockNext);

      // Should truncate to 200 characters
      expect(mockReq.query.q).toHaveLength(200);
      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle multiple parameters efficiently', () => {
      // Create a request with many parameters
      mockReq.params = {};
      mockReq.query = {};
      
      for (let i = 0; i < 50; i++) {
        mockReq.params[`param${i}`] = `value${i}<script>`;
        mockReq.query[`query${i}`] = `search${i}<script>`;
      }

      const startTime = Date.now();
      sanitizeParameters(mockReq, mockRes, mockNext);
      const endTime = Date.now();

      // Should complete quickly (under 100ms for 100 parameters)
      expect(endTime - startTime).toBeLessThan(100);
      expect(mockNext).toHaveBeenCalled();
    });
  });
});