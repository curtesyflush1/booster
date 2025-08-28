import { Request, Response, NextFunction } from 'express';
import { sanitizeParameters, sanitizeProductParameters } from '../../src/middleware/parameterSanitization';
import { 
  sanitizeUrlParameter, 
  sanitizeSetName, 
  sanitizeSlug, 
  sanitizeUUID, 
  sanitizeUPC, 
  sanitizeSearchQuery 
} from '../../src/utils/validation';
import { logger } from '../../src/utils/logger';

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Parameter Sanitization Middleware', () => {
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
      correlationId: 'test-123',
      get: jest.fn().mockReturnValue('test-agent')
    };
    mockRes = {};
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('sanitizeParameters middleware', () => {
    it('should sanitize URL parameters', () => {
      mockReq.params = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        setName: 'Scarlet & Violet<script>alert("xss")</script>',
        slug: 'test-slug-123'
      };

      sanitizeParameters(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.params!.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(mockReq.params!.setName).toBe('Scarlet & Violetscriptalert(xss)script');
      expect(mockReq.params!.slug).toBe('test-slug-123');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should sanitize query parameters', () => {
      mockReq.query = {
        q: 'pokemon<script>alert("xss")</script>',
        upc: '123456789012',
        category_id: '123e4567-e89b-12d3-a456-426614174000'
      };

      sanitizeParameters(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.query!.q).toBe('pokemonscriptalert(xss)script');
      expect(mockReq.query!.upc).toBe('123456789012');
      expect(mockReq.query!.category_id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle array query parameters', () => {
      mockReq.query = {
        tags: ['tag1<script>', 'tag2', 'tag3&amp;']
      };

      sanitizeParameters(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.query!.tags).toEqual(['tag1script', 'tag2', 'tag3&amp']);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should log when parameters are modified', () => {
      mockReq.params = {
        setName: 'Test Set<script>alert("xss")</script>'
      };

      sanitizeParameters(mockReq as Request, mockRes as Response, mockNext);

      expect(logger.warn).toHaveBeenCalledWith('URL parameters were sanitized', expect.objectContaining({
        path: '/test',
        method: 'GET',
        originalParams: { setName: 'Test Set<script>alert("xss")</script>' },
        sanitizedParams: { setName: 'Test Setscriptalert(xss)script' }
      }));
    });

    it('should handle errors gracefully', () => {
      // Create a request object that will cause an error by making params throw
      const badReq = {
        ...mockReq,
        get params() { throw new Error('Test error'); }
      };

      sanitizeParameters(badReq as any, mockRes as Response, mockNext);

      expect(logger.error).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('sanitizeProductParameters middleware', () => {
    it('should specially handle setName parameter', () => {
      mockReq.params = {
        setName: 'Pok%C3%A9mon%20TCG<script>alert("xss")</script>'
      };

      sanitizeProductParameters(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.params!.setName).toBe('Pokémon TCGscriptalert(xss)script');
      expect(logger.warn).toHaveBeenCalledWith('Set name parameter was sanitized', expect.objectContaining({
        path: '/test',
        original: 'Pok%C3%A9mon%20TCG<script>alert("xss")</script>',
        sanitized: 'Pokémon TCGscriptalert(xss)script'
      }));
    });
  });
});

describe('Sanitization Utility Functions', () => {
  describe('sanitizeUrlParameter', () => {
    it('should remove dangerous characters', () => {
      const input = 'test<script>alert("xss")</script>';
      const result = sanitizeUrlParameter(input);
      expect(result).toBe('testscriptalert("xss")/script');
    });

    it('should remove null bytes and control characters', () => {
      const input = 'test\x00\x01\x1F\x7F';
      const result = sanitizeUrlParameter(input);
      expect(result).toBe('test');
    });

    it('should limit length to 200 characters', () => {
      const input = 'a'.repeat(250);
      const result = sanitizeUrlParameter(input);
      expect(result).toHaveLength(200);
    });

    it('should handle non-string input', () => {
      expect(sanitizeUrlParameter(null as any)).toBe('');
      expect(sanitizeUrlParameter(undefined as any)).toBe('');
      expect(sanitizeUrlParameter(123 as any)).toBe('');
    });
  });

  describe('sanitizeSetName', () => {
    it('should decode URI components safely', () => {
      const input = 'Pok%C3%A9mon%20TCG';
      const result = sanitizeSetName(input);
      expect(result).toBe('Pokémon TCG');
    });

    it('should handle invalid URI encoding', () => {
      const input = 'Test%ZZ%Invalid';
      const result = sanitizeSetName(input);
      expect(result).toBe('TestZZInvalid');
    });

    it('should allow Pokemon set name characters', () => {
      const input = "Scarlet & Violet - Paldea Evolved";
      const result = sanitizeSetName(input);
      expect(result).toBe("Scarlet & Violet - Paldea Evolved");
    });

    it('should remove dangerous characters but keep valid ones', () => {
      const input = "Test Set<script>alert('xss')</script> & More";
      const result = sanitizeSetName(input);
      expect(result).toBe("Test Setscriptalert(xss)script & More");
    });
  });

  describe('sanitizeSlug', () => {
    it('should convert to lowercase and keep valid characters', () => {
      const input = 'Test-Slug-123';
      const result = sanitizeSlug(input);
      expect(result).toBe('test-slug-123');
    });

    it('should remove invalid characters', () => {
      const input = 'test_slug@#$%^&*()';
      const result = sanitizeSlug(input);
      expect(result).toBe('testslug');
    });

    it('should handle multiple consecutive hyphens', () => {
      const input = 'test---slug';
      const result = sanitizeSlug(input);
      expect(result).toBe('test-slug');
    });

    it('should remove leading and trailing hyphens', () => {
      const input = '-test-slug-';
      const result = sanitizeSlug(input);
      expect(result).toBe('test-slug');
    });
  });

  describe('sanitizeUUID', () => {
    it('should validate and sanitize valid UUIDs', () => {
      const input = '123E4567-E89B-12D3-A456-426614174000';
      const result = sanitizeUUID(input);
      expect(result).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should return empty string for invalid UUIDs', () => {
      const input = 'not-a-uuid';
      const result = sanitizeUUID(input);
      expect(result).toBe('');
    });

    it('should return empty string for invalid UUIDs with extra characters', () => {
      const input = '123e4567-e89b-12d3-a456-426614174000<script>';
      const result = sanitizeUUID(input);
      expect(result).toBe(''); // Invalid UUID after sanitization
    });
  });

  describe('sanitizeUPC', () => {
    it('should keep only digits', () => {
      const input = '123-456-789-012';
      const result = sanitizeUPC(input);
      expect(result).toBe('123456789012');
    });

    it('should return empty string for invalid length', () => {
      expect(sanitizeUPC('1234567')).toBe(''); // too short
      expect(sanitizeUPC('123456789012345')).toBe(''); // too long
    });

    it('should handle valid UPC lengths', () => {
      expect(sanitizeUPC('12345678')).toBe('12345678'); // 8 digits
      expect(sanitizeUPC('12345678901234')).toBe('12345678901234'); // 14 digits
    });
  });

  describe('sanitizeSearchQuery', () => {
    it('should allow common search characters', () => {
      const input = 'pokemon cards: "rare" & "holographic"!';
      const result = sanitizeSearchQuery(input);
      expect(result).toBe('pokemon cards: "rare" & "holographic"!');
    });

    it('should remove dangerous characters', () => {
      const input = 'search<script>alert("xss")</script>';
      const result = sanitizeSearchQuery(input);
      expect(result).toBe('searchscriptalert(xss)script');
    });

    it('should normalize whitespace', () => {
      const input = 'pokemon    cards   with   spaces';
      const result = sanitizeSearchQuery(input);
      expect(result).toBe('pokemon cards with spaces');
    });

    it('should limit length to 200 characters', () => {
      const input = 'search '.repeat(50);
      const result = sanitizeSearchQuery(input);
      expect(result.length).toBeLessThanOrEqual(200);
    });
  });
});