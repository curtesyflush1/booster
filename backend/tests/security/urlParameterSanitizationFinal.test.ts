import { Request, Response, NextFunction } from 'express';
import { sanitizeParameters } from '../../src/middleware/parameterSanitization';
import { 
  sanitizeUrlParameter, 
  sanitizeSetName, 
  sanitizeSlug, 
  sanitizeUUID, 
  sanitizeUPC, 
  sanitizeSearchQuery 
} from '../../src/utils/validation';
import { logger } from '../../src/utils/logger';

// Mock logger to prevent console spam during tests
jest.mock('../../src/utils/logger');

describe('URL Parameter Sanitization - Final Security Verification', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

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

  describe('SQL Injection Prevention - Critical Security Test', () => {
    const criticalSQLPayloads = [
      "'; DROP TABLE users; --",
      "' OR '1'='1",
      "'; DELETE FROM products WHERE '1'='1'; --",
      "' UNION SELECT * FROM users --",
      "'; INSERT INTO users (email) VALUES ('hacker@evil.com'); --",
      "' OR 1=1 --",
      "'; UPDATE users SET role='admin' WHERE '1'='1'; --",
      "admin'--",
      "admin'/*",
      "' OR 'x'='x",
      "') OR ('1'='1",
      "' AND (SELECT COUNT(*) FROM users) > 0 --"
    ];

    test.each(criticalSQLPayloads)('should prevent SQL injection in UUID parameters: %s', (payload) => {
      mockReq.params = {
        id: payload,
        userId: payload,
        productId: payload
      };

      sanitizeParameters(mockReq as Request, mockRes as Response, mockNext);

      // All UUID parameters should be empty after sanitization (invalid format)
      expect(mockReq.params!.id).toBe('');
      expect(mockReq.params!.userId).toBe('');
      expect(mockReq.params!.productId).toBe('');
      
      // Should log sanitization
      expect(logger.warn).toHaveBeenCalled();
    });

    test.each(criticalSQLPayloads)('should sanitize SQL injection in search parameters: %s', (payload) => {
      mockReq.query = {
        q: payload,
        search: payload
      };

      sanitizeParameters(mockReq as Request, mockRes as Response, mockNext);

      // Search parameters should be sanitized but not empty
      expect(mockReq.query!.q).not.toContain(';');
      expect(mockReq.query!.q).not.toContain('--');
      expect(mockReq.query!.search).not.toContain(';');
      expect(mockReq.query!.search).not.toContain('--');
    });
  });

  describe('XSS Prevention - Critical Security Test', () => {
    const criticalXSSPayloads = [
      '<script>alert("xss")</script>',
      '<img src="x" onerror="alert(1)">',
      'javascript:alert("xss")',
      '<svg onload="alert(1)">',
      '"><script>alert("xss")</script>',
      '<iframe src="javascript:alert(1)"></iframe>',
      '<body onload="alert(1)">',
      '<div onclick="alert(1)">',
      '<a href="javascript:alert(1)">',
      'data:text/html,<script>alert(1)</script>'
    ];

    test.each(criticalXSSPayloads)('should prevent XSS in all parameter types: %s', (payload) => {
      mockReq.params = {
        slug: payload,
        setName: payload,
        general: payload
      };

      mockReq.query = {
        q: payload,
        search: payload
      };

      sanitizeParameters(mockReq as Request, mockRes as Response, mockNext);

      // Should remove all XSS vectors
      expect(mockReq.params!.slug).not.toContain('<script');
      expect(mockReq.params!.slug).not.toContain('javascript:');
      expect(mockReq.params!.setName).not.toContain('<script');
      expect(mockReq.params!.setName).not.toContain('javascript:');
      expect(mockReq.params!.general).not.toContain('<script');
      expect(mockReq.params!.general).not.toContain('javascript:');
      expect(mockReq.query!.q).not.toContain('<script');
      expect(mockReq.query!.q).not.toContain('javascript:');
      expect(mockReq.query!.search).not.toContain('<script');
      expect(mockReq.query!.search).not.toContain('javascript:');
    });
  });

  describe('Path Traversal Prevention - Critical Security Test', () => {
    const pathTraversalPayloads = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      '....//....//....//etc/passwd',
      '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      '..%252f..%252f..%252fetc%252fpasswd',
      '..%c0%af..%c0%af..%c0%afetc%c0%afpasswd',
      '..%c1%9c..%c1%9c..%c1%9cetc%c1%9cpasswd'
    ];

    test.each(pathTraversalPayloads)('should prevent path traversal: %s', (payload) => {
      mockReq.params = {
        filename: payload,
        path: payload
      };

      sanitizeParameters(mockReq as Request, mockRes as Response, mockNext);

      // Should remove path traversal sequences
      expect(mockReq.params!.filename).not.toContain('../');
      expect(mockReq.params!.filename).not.toContain('..\\');
      expect(mockReq.params!.path).not.toContain('../');
      expect(mockReq.params!.path).not.toContain('..\\');
    });
  });

  describe('Null Byte Injection Prevention', () => {
    const nullBytePayloads = [
      'test\x00.txt',
      'test%00.txt',
      'test\u0000.txt',
      'test%00%2e%2e%2f%2e%2e%2fetc%2fpasswd'
    ];

    test.each(nullBytePayloads)('should prevent null byte injection: %s', (payload) => {
      mockReq.params = {
        filename: payload
      };

      sanitizeParameters(mockReq as Request, mockRes as Response, mockNext);

      // Should remove null bytes
      expect(mockReq.params!.filename).not.toContain('\x00');
      expect(mockReq.params!.filename).not.toContain('\u0000');
      expect(mockReq.params!.filename).not.toContain('%00');
    });
  });

  describe('Parameter Type Validation', () => {
    test('should validate UUID parameters correctly', () => {
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';
      const invalidUUIDs = [
        'not-a-uuid',
        '123-456-789',
        'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        '123e4567-e89b-12d3-a456-42661417400g' // Invalid character
      ];

      // Test valid UUID
      expect(sanitizeUUID(validUUID)).toBe(validUUID);

      // Test invalid UUIDs
      invalidUUIDs.forEach(uuid => {
        expect(sanitizeUUID(uuid)).toBe('');
      });
    });

    test('should validate UPC parameters correctly', () => {
      const validUPCs = ['123456789012', '12345678901234'];
      const invalidUPCs = [
        'not-a-upc',
        '123',
        '123456789012345678901', // Too long
        '1234567a9012' // Contains letter
      ];

      // Test valid UPCs
      validUPCs.forEach(upc => {
        expect(sanitizeUPC(upc)).toBe(upc);
      });

      // Test invalid UPCs
      invalidUPCs.forEach(upc => {
        expect(sanitizeUPC(upc)).toBe('');
      });
    });

    test('should handle Pokemon set names correctly', () => {
      const validSetNames = [
        'Scarlet & Violet',
        'Sun & Moon: Team Up',
        'Pokémon TCG',
        'Base Set 2'
      ];

      const maliciousSetNames = [
        "Scarlet & Violet<script>alert('xss')</script>",
        "Base Set'; DROP TABLE products; --"
      ];

      // Test valid set names
      validSetNames.forEach(setName => {
        const sanitized = sanitizeSetName(setName);
        expect(sanitized).toContain(setName.replace(/[^a-zA-Z0-9\s\-&':.()éèàùâêîôûç]/g, ''));
      });

      // Test malicious set names
      maliciousSetNames.forEach(setName => {
        const sanitized = sanitizeSetName(setName);
        expect(sanitized).not.toContain('<script');
        expect(sanitized).not.toContain(';');
        expect(sanitized).not.toContain('--');
      });
    });
  });

  describe('Performance and DoS Prevention', () => {
    test('should enforce length limits', () => {
      const longPayload = 'a'.repeat(500);
      
      mockReq.query = {
        q: longPayload
      };

      sanitizeParameters(mockReq as Request, mockRes as Response, mockNext);

      // Should be truncated to 200 characters
      expect(mockReq.query!.q).toHaveLength(200);
    });

    test('should handle large number of parameters efficiently', () => {
      // Create request with many parameters
      mockReq.params = {};
      mockReq.query = {};
      
      for (let i = 0; i < 100; i++) {
        mockReq.params![`param${i}`] = `value${i}`;
        mockReq.query![`query${i}`] = `search${i}`;
      }

      const startTime = Date.now();
      sanitizeParameters(mockReq as Request, mockRes as Response, mockNext);
      const endTime = Date.now();

      // Should complete quickly
      expect(endTime - startTime).toBeLessThan(50);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Real-world Attack Scenarios', () => {
    test('should prevent combined SQL injection and XSS attack', () => {
      const combinedPayload = "'; DROP TABLE users; --<script>alert('xss')</script>";
      
      mockReq.params = {
        id: combinedPayload
      };
      mockReq.query = {
        q: combinedPayload
      };

      sanitizeParameters(mockReq as Request, mockRes as Response, mockNext);

      // UUID should be empty (invalid format)
      expect(mockReq.params!.id).toBe('');
      
      // Search should be sanitized
      expect(mockReq.query!.q).not.toContain(';');
      expect(mockReq.query!.q).not.toContain('--');
      expect(mockReq.query!.q).not.toContain('<script');
    });

    test('should prevent encoded attack payloads', () => {
      const encodedPayloads = [
        '%3Cscript%3Ealert%28%27xss%27%29%3C%2Fscript%3E', // <script>alert('xss')</script>
        '%27%3B%20DROP%20TABLE%20users%3B%20--', // '; DROP TABLE users; --
        '%2E%2E%2F%2E%2E%2F%2E%2E%2Fetc%2Fpasswd' // ../../../etc/passwd
      ];

      encodedPayloads.forEach(payload => {
        mockReq.params = {
          test: payload
        };

        sanitizeParameters(mockReq as Request, mockRes as Response, mockNext);

        // Should be sanitized after decoding
        expect(mockReq.params!.test).not.toContain('<script');
        expect(mockReq.params!.test).not.toContain(';');
        expect(mockReq.params!.test).not.toContain('--');
        expect(mockReq.params!.test).not.toContain('../');
      });
    });

    test('should handle double-encoded payloads', () => {
      const doubleEncodedScript = '%253Cscript%253E'; // Double-encoded <script>
      
      mockReq.params = {
        test: doubleEncodedScript
      };

      sanitizeParameters(mockReq as Request, mockRes as Response, mockNext);

      // Should handle double encoding
      expect(mockReq.params!.test).not.toContain('<script');
      expect(mockReq.params!.test).not.toContain('%3C');
    });
  });

  describe('Logging and Monitoring', () => {
    test('should log all sanitization events for security monitoring', () => {
      const maliciousPayload = '<script>alert("xss")</script>';
      
      mockReq.params = {
        test: maliciousPayload
      };

      sanitizeParameters(mockReq as Request, mockRes as Response, mockNext);

      // Should log with proper context
      expect(logger.warn).toHaveBeenCalledWith(
        'URL parameters were sanitized',
        expect.objectContaining({
          path: '/test',
          method: 'GET',
          ip: '127.0.0.1',
          userAgent: 'test-user-agent',
          correlationId: 'test-correlation-id'
        })
      );
    });

    test('should include original and sanitized values in logs', () => {
      const maliciousPayload = '<script>alert("xss")</script>';
      
      mockReq.params = {
        test: maliciousPayload
      };

      sanitizeParameters(mockReq as Request, mockRes as Response, mockNext);

      const logCall = (logger.warn as jest.Mock).mock.calls[0];
      const logData = logCall[1];
      
      expect(logData.originalParams).toEqual({ test: maliciousPayload });
      expect(logData.sanitizedParams.test).not.toContain('<script');
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle malformed requests gracefully', () => {
      const badReq = {
        params: null,
        query: undefined,
        path: '/test',
        method: 'GET'
      };

      expect(() => {
        sanitizeParameters(badReq as any, mockRes as Response, mockNext);
      }).not.toThrow();

      expect(mockNext).toHaveBeenCalled();
    });

    test('should continue processing even if sanitization fails', () => {
      // Mock a sanitization function to throw an error
      const originalSanitize = sanitizeUrlParameter;
      jest.doMock('../../src/utils/validation', () => ({
        ...jest.requireActual('../../src/utils/validation'),
        sanitizeUrlParameter: jest.fn().mockImplementation(() => {
          throw new Error('Sanitization error');
        })
      }));

      mockReq.params = {
        test: 'value'
      };

      sanitizeParameters(mockReq as Request, mockRes as Response, mockNext);

      // Should still call next even if there's an error
      expect(mockNext).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });
  });
});