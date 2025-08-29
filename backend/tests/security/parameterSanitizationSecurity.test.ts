import { Request, Response, NextFunction } from 'express';
import { sanitizeParameters, sanitizeProductParameters } from '../../src/middleware/parameterSanitization';
import { logger } from '../../src/utils/logger';

// Mock logger to prevent console spam during tests
jest.mock('../../src/utils/logger');

describe('Parameter Sanitization Security Tests', () => {
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

  describe('SQL Injection Prevention', () => {
    const sqlInjectionPayloads = [
      "'; DROP TABLE users; --",
      "' OR '1'='1",
      "'; DELETE FROM products WHERE '1'='1'; --",
      "' UNION SELECT * FROM users --",
      "'; INSERT INTO users (email) VALUES ('hacker@evil.com'); --",
      "' OR 1=1 --",
      "'; UPDATE users SET role='admin' WHERE '1'='1'; --"
    ];

    test.each(sqlInjectionPayloads)('should sanitize SQL injection in URL parameters: %s', (payload) => {
      mockReq.params = {
        id: payload,
        categoryId: payload
      };

      sanitizeParameters(mockReq as Request, mockRes as Response, mockNext);

      // Verify SQL injection characters are removed
      expect(mockReq.params!.id).not.toContain(';');
      expect(mockReq.params!.id).not.toContain('--');
      expect(mockReq.params!.id).not.toContain('DROP');
      expect(mockReq.params!.id).not.toContain('DELETE');
      expect(mockReq.params!.id).not.toContain('INSERT');
      expect(mockReq.params!.id).not.toContain('UPDATE');
      expect(mockReq.params!.id).not.toContain('UNION');
      expect(mockReq.params!.id).not.toContain('SELECT');

      expect(mockReq.params!.categoryId).not.toContain(';');
      expect(mockReq.params!.categoryId).not.toContain('--');
    });

    test.each(sqlInjectionPayloads)('should sanitize SQL injection in query parameters: %s', (payload) => {
      mockReq.query = {
        q: payload,
        category_id: payload
      };

      sanitizeParameters(mockReq as Request, mockRes as Response, mockNext);

      // Verify SQL injection characters are removed
      expect(mockReq.query!.q).not.toContain(';');
      expect(mockReq.query!.q).not.toContain('--');
      expect(mockReq.query!.category_id).not.toContain(';');
      expect(mockReq.query!.category_id).not.toContain('--');
    });
  });

  describe('XSS Prevention', () => {
    const xssPayloads = [
      '<script>alert("xss")</script>',
      '<img src="x" onerror="alert(1)">',
      'javascript:alert("xss")',
      '<svg onload="alert(1)">',
      '"><script>alert("xss")</script>',
      '<iframe src="javascript:alert(1)"></iframe>'
    ];

    test.each(xssPayloads)('should sanitize XSS in parameters: %s', (payload) => {
      mockReq.params = {
        slug: payload
      };
      mockReq.query = {
        q: payload
      };

      sanitizeParameters(mockReq as Request, mockRes as Response, mockNext);

      // Verify XSS vectors are removed
      expect(mockReq.params!.slug).not.toContain('<script');
      expect(mockReq.params!.slug).not.toContain('<img');
      expect(mockReq.params!.slug).not.toContain('<svg');
      expect(mockReq.params!.slug).not.toContain('<iframe');
      expect(mockReq.params!.slug).not.toContain('javascript:');

      expect(mockReq.query!.q).not.toContain('<script');
      expect(mockReq.query!.q).not.toContain('<img');
      expect(mockReq.query!.q).not.toContain('<svg');
      expect(mockReq.query!.q).not.toContain('<iframe');
      expect(mockReq.query!.q).not.toContain('javascript:');
    });
  });

  describe('Null Byte Injection Prevention', () => {
    const nullBytePayloads = [
      'test\x00.txt',
      'test%00.txt',
      'test\u0000.txt'
    ];

    test.each(nullBytePayloads)('should sanitize null bytes: %s', (payload) => {
      mockReq.params = {
        filename: payload
      };

      sanitizeParameters(mockReq as Request, mockRes as Response, mockNext);

      // Verify null bytes are removed
      expect(mockReq.params!.filename).not.toContain('\x00');
      expect(mockReq.params!.filename).not.toContain('\u0000');
      expect(mockReq.params!.filename).toBe('test.txt');
    });
  });

  describe('Control Character Prevention', () => {
    test('should remove control characters', () => {
      const payload = 'test\x01\x02\x03\x1F\x7F';
      mockReq.params = {
        data: payload
      };

      sanitizeParameters(mockReq as Request, mockRes as Response, mockNext);

      // Verify control characters are removed
      expect(mockReq.params!.data).toBe('test');
      expect(mockReq.params!.data).not.toMatch(/[\x00-\x1F\x7F]/);
    });
  });

  describe('Length Limit Enforcement', () => {
    test('should truncate overly long parameters', () => {
      const longPayload = 'a'.repeat(300); // Longer than 200 char limit
      mockReq.params = {
        longParam: longPayload
      };

      sanitizeParameters(mockReq as Request, mockRes as Response, mockNext);

      // Verify length is limited to 200 characters
      expect(mockReq.params!.longParam).toHaveLength(200);
      expect(mockReq.params!.longParam).toBe('a'.repeat(200));
    });
  });

  describe('UUID Parameter Sanitization', () => {
    test('should sanitize UUID parameters correctly', () => {
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';
      const maliciousUUID = "123e4567-e89b-12d3-a456-426614174000'; DROP TABLE users; --";
      
      mockReq.params = {
        id: maliciousUUID,
        userId: validUUID
      };

      sanitizeParameters(mockReq as Request, mockRes as Response, mockNext);

      // Valid UUID should remain unchanged
      expect(mockReq.params!.userId).toBe(validUUID);
      
      // Malicious UUID should be sanitized (will become empty due to invalid format)
      expect(mockReq.params!.id).toBe('');
    });
  });

  describe('Set Name Parameter Sanitization', () => {
    test('should handle Pokemon set names correctly', () => {
      const validSetName = 'Scarlet & Violet: Paldea Evolved';
      const maliciousSetName = "Scarlet & Violet<script>alert('xss')</script>";
      
      mockReq.params = {
        setName: maliciousSetName
      };

      sanitizeProductParameters(mockReq as Request, mockRes as Response, mockNext);

      // Should remove script tags but keep valid characters
      expect(mockReq.params!.setName).toContain('Scarlet & Violet');
      expect(mockReq.params!.setName).not.toContain('<script');
      expect(mockReq.params!.setName).not.toContain('</script>');
    });

    test('should handle URL encoded set names', () => {
      const encodedSetName = 'Pok%C3%A9mon%20TCG';
      
      mockReq.params = {
        setName: encodedSetName
      };

      sanitizeProductParameters(mockReq as Request, mockRes as Response, mockNext);

      // Should decode and sanitize properly
      expect(mockReq.params!.setName).toContain('Pokémon TCG');
    });
  });

  describe('UPC Parameter Sanitization', () => {
    test('should sanitize UPC parameters correctly', () => {
      const validUPC = '123456789012';
      const maliciousUPC = "123456789012'; DROP TABLE products; --";
      
      mockReq.params = {
        upc: maliciousUPC
      };
      mockReq.query = {
        upc: validUPC
      };

      sanitizeParameters(mockReq as Request, mockRes as Response, mockNext);

      // Valid UPC should remain unchanged
      expect(mockReq.query!.upc).toBe(validUPC);
      
      // Malicious UPC should be sanitized to only digits
      expect(mockReq.params!.upc).toBe('123456789012');
    });
  });

  describe('Search Query Sanitization', () => {
    test('should sanitize search queries while preserving search functionality', () => {
      const searchQuery = 'pokemon cards "rare" & special';
      const maliciousQuery = 'pokemon<script>alert("xss")</script> cards';
      
      mockReq.query = {
        q: maliciousQuery,
        search: searchQuery
      };

      sanitizeParameters(mockReq as Request, mockRes as Response, mockNext);

      // Should preserve search-friendly characters
      expect(mockReq.query!.search).toContain('pokemon cards');
      expect(mockReq.query!.search).toContain('"rare"');
      expect(mockReq.query!.search).toContain('&');
      
      // Should remove script tags
      expect(mockReq.query!.q).toContain('pokemon');
      expect(mockReq.query!.q).toContain('cards');
      expect(mockReq.query!.q).not.toContain('<script');
      expect(mockReq.query!.q).not.toContain('</script>');
    });
  });

  describe('Array Parameter Sanitization', () => {
    test('should sanitize array parameters', () => {
      mockReq.query = {
        tags: ['tag1<script>', 'tag2', "tag3'; DROP TABLE tags; --"]
      };

      sanitizeParameters(mockReq as Request, mockRes as Response, mockNext);

      // Should sanitize each array element
      expect(mockReq.query!.tags).toEqual(['tag1script', 'tag2', 'tag3 DROP TABLE tags ']);
    });
  });

  describe('Logging of Sanitization Events', () => {
    test('should log when parameters are modified', () => {
      const maliciousPayload = '<script>alert("xss")</script>';
      mockReq.params = {
        test: maliciousPayload
      };

      sanitizeParameters(mockReq as Request, mockRes as Response, mockNext);

      // Should log the sanitization event
      expect(logger.warn).toHaveBeenCalledWith(
        'URL parameters were sanitized',
        expect.objectContaining({
          path: '/test',
          method: 'GET',
          originalParams: { test: maliciousPayload },
          sanitizedParams: { test: 'scriptalert("xss")script' }
        })
      );
    });

    test('should not log when no parameters are modified', () => {
      mockReq.params = {
        id: '123e4567-e89b-12d3-a456-426614174000'
      };

      sanitizeParameters(mockReq as Request, mockRes as Response, mockNext);

      // Should not log if nothing was changed
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle errors gracefully and continue processing', () => {
      // Create a request that might cause an error
      const badReq = {
        params: null,
        query: null,
        path: '/test',
        method: 'GET'
      };

      sanitizeParameters(badReq as any, mockRes as Response, mockNext);

      // Should call next() even if there's an error
      expect(mockNext).toHaveBeenCalled();
      
      // Should log the error
      expect(logger.error).toHaveBeenCalledWith(
        'Error in parameter sanitization middleware',
        expect.objectContaining({
          path: '/test',
          method: 'GET'
        })
      );
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty parameters', () => {
      mockReq.params = {
        empty: '',
        whitespace: '   '
      };

      sanitizeParameters(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.params!.empty).toBe('');
      expect(mockReq.params!.whitespace).toBe('');
    });

    test('should handle non-string parameters', () => {
      mockReq.params = {
        number: 123 as any,
        boolean: true as any,
        object: { test: 'value' } as any
      };

      sanitizeParameters(mockReq as Request, mockRes as Response, mockNext);

      // Non-string parameters should remain unchanged
      expect(mockReq.params!.number).toBe(123);
      expect(mockReq.params!.boolean).toBe(true);
      expect(mockReq.params!.object).toEqual({ test: 'value' });
    });

    test('should handle undefined and null parameters', () => {
      mockReq.params = {
        undefined: undefined as any,
        null: null as any
      };

      sanitizeParameters(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.params!.undefined).toBeUndefined();
      expect(mockReq.params!.null).toBeNull();
    });
  });
});