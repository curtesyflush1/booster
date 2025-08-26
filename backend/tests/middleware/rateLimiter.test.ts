import { Request, Response, NextFunction } from 'express';
import { 
  createRateLimit, 
  generalRateLimit, 
  authRateLimit, 
  passwordResetRateLimit,
  registrationRateLimit,
  strictRateLimit,
  rateLimitStore 
} from '../../src/middleware/rateLimiter';

describe('Rate Limiter Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let originalDisableRateLimit: string | undefined;

  beforeAll(() => {
    // Enable rate limiting for these tests
    originalDisableRateLimit = process.env.DISABLE_RATE_LIMITING;
    delete process.env.DISABLE_RATE_LIMITING;
  });

  afterAll(() => {
    // Restore original setting
    if (originalDisableRateLimit !== undefined) {
      process.env.DISABLE_RATE_LIMITING = originalDisableRateLimit;
    }
  });

  beforeEach(() => {
    mockRequest = {
      ip: '127.0.0.1',
      path: '/test',
      method: 'GET'
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      statusCode: 200
    };
    mockNext = jest.fn();
    
    // Clear rate limit store before each test
    rateLimitStore.destroy();
    jest.clearAllMocks();
  });

  afterAll(() => {
    rateLimitStore.destroy();
  });

  describe('createRateLimit', () => {
    it('should allow requests within limit', () => {
      const rateLimit = createRateLimit({
        windowMs: 60000, // 1 minute
        maxRequests: 5
      });

      // Make 5 requests (within limit)
      for (let i = 0; i < 5; i++) {
        rateLimit(mockRequest as Request, mockResponse as Response, mockNext);
        expect(mockNext).toHaveBeenCalledTimes(i + 1);
        expect(mockResponse.status).not.toHaveBeenCalled();
      }
    });

    it('should block requests exceeding limit', () => {
      const rateLimit = createRateLimit({
        windowMs: 60000, // 1 minute
        maxRequests: 3,
        message: 'Custom rate limit message'
      });

      // Make 3 requests (at limit)
      for (let i = 0; i < 3; i++) {
        rateLimit(mockRequest as Request, mockResponse as Response, mockNext);
      }

      // 4th request should be blocked
      rateLimit(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Custom rate limit message',
          timestamp: expect.any(String),
          retryAfter: expect.any(Number)
        }
      });
      expect(mockNext).toHaveBeenCalledTimes(3); // Only first 3 calls
    });

    it('should set rate limit headers', () => {
      const rateLimit = createRateLimit({
        windowMs: 60000,
        maxRequests: 10
      });

      rateLimit(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.set).toHaveBeenCalledWith({
        'X-RateLimit-Limit': '10',
        'X-RateLimit-Remaining': '9',
        'X-RateLimit-Reset': expect.any(String)
      });
    });

    it('should reset limit after window expires', (done) => {
      const rateLimit = createRateLimit({
        windowMs: 100, // 100ms window
        maxRequests: 2
      });

      // Use up the limit
      rateLimit(mockRequest as Request, mockResponse as Response, mockNext);
      rateLimit(mockRequest as Request, mockResponse as Response, mockNext);
      
      // This should be blocked
      rateLimit(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(429);

      // Wait for window to reset
      setTimeout(() => {
        jest.clearAllMocks();
        
        // This should be allowed again
        rateLimit(mockRequest as Request, mockResponse as Response, mockNext);
        expect(mockNext).toHaveBeenCalled();
        expect(mockResponse.status).not.toHaveBeenCalled();
        done();
      }, 150);
    });

    it('should handle different IP addresses separately', () => {
      const rateLimit = createRateLimit({
        windowMs: 60000,
        maxRequests: 2
      });

      const request1 = { ...mockRequest, ip: '127.0.0.1' };
      const request2 = { ...mockRequest, ip: '192.168.1.1' };

      // Use up limit for first IP
      rateLimit(request1 as Request, mockResponse as Response, mockNext);
      rateLimit(request1 as Request, mockResponse as Response, mockNext);
      rateLimit(request1 as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(429);
      jest.clearAllMocks();

      // Second IP should still be allowed
      rateLimit(request2 as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should configure skip options correctly', () => {
      const rateLimitWithSkip = createRateLimit({
        windowMs: 60000,
        maxRequests: 2,
        skipSuccessfulRequests: true
      });

      // Should create middleware without errors
      expect(typeof rateLimitWithSkip).toBe('function');

      // Test basic functionality still works
      rateLimitWithSkip(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('predefined rate limiters', () => {
    it('should have correct configuration for generalRateLimit', () => {
      // Test that it allows reasonable number of requests
      for (let i = 0; i < 50; i++) {
        generalRateLimit(mockRequest as Request, mockResponse as Response, mockNext);
      }
      
      expect(mockNext).toHaveBeenCalledTimes(50);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should have strict limits for authRateLimit', () => {
      // Auth rate limit should be more restrictive
      for (let i = 0; i < 5; i++) {
        authRateLimit(mockRequest as Request, mockResponse as Response, mockNext);
      }
      
      expect(mockNext).toHaveBeenCalledTimes(5);
      
      // 6th request should be blocked
      authRateLimit(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(429);
    });

    it('should have very strict limits for passwordResetRateLimit', () => {
      // Password reset should be very limited
      for (let i = 0; i < 3; i++) {
        passwordResetRateLimit(mockRequest as Request, mockResponse as Response, mockNext);
      }
      
      expect(mockNext).toHaveBeenCalledTimes(3);
      
      // 4th request should be blocked
      passwordResetRateLimit(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(429);
    });

    it('should have strict limits for registrationRateLimit', () => {
      // Registration should be limited
      for (let i = 0; i < 3; i++) {
        registrationRateLimit(mockRequest as Request, mockResponse as Response, mockNext);
      }
      
      expect(mockNext).toHaveBeenCalledTimes(3);
      
      // 4th request should be blocked
      registrationRateLimit(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(429);
    });

    it('should have very strict limits for strictRateLimit', () => {
      // Strict rate limit should be very limited
      for (let i = 0; i < 10; i++) {
        strictRateLimit(mockRequest as Request, mockResponse as Response, mockNext);
      }
      
      expect(mockNext).toHaveBeenCalledTimes(10);
      
      // 11th request should be blocked
      strictRateLimit(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(429);
    });
  });

  describe('rate limit store', () => {
    it('should clean up expired entries', (done) => {
      const rateLimit = createRateLimit({
        windowMs: 50, // Very short window
        maxRequests: 1
      });

      // Make a request to create an entry
      rateLimit(mockRequest as Request, mockResponse as Response, mockNext);
      
      // Verify entry exists by making another request (should be blocked)
      rateLimit(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(429);

      // Wait for cleanup (store cleans up every minute, but entry should expire)
      setTimeout(() => {
        jest.clearAllMocks();
        
        // Should be allowed again after expiry
        rateLimit(mockRequest as Request, mockResponse as Response, mockNext);
        expect(mockNext).toHaveBeenCalled();
        expect(mockResponse.status).not.toHaveBeenCalled();
        done();
      }, 100);
    });

    it('should handle store destruction gracefully', () => {
      const rateLimit = createRateLimit({
        windowMs: 60000,
        maxRequests: 5
      });

      // Make some requests
      rateLimit(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();

      // Destroy store
      rateLimitStore.destroy();

      // Should still work (creates new entries)
      jest.clearAllMocks();
      rateLimit(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle missing IP address gracefully', () => {
      const requestWithoutIP = { ...mockRequest, ip: undefined };
      const rateLimit = createRateLimit({
        windowMs: 60000,
        maxRequests: 5
      });

      // Should not throw error
      expect(() => {
        rateLimit(requestWithoutIP as Request, mockResponse as Response, mockNext);
      }).not.toThrow();
    });

    it('should handle response modification errors gracefully', () => {
      const rateLimit = createRateLimit({
        windowMs: 60000,
        maxRequests: 1,
        skipSuccessfulRequests: true
      });

      const mockBrokenResponse = {
        ...mockResponse,
        send: jest.fn(() => {
          throw new Error('Response error');
        })
      };

      // Should not throw error even if response modification fails
      expect(() => {
        rateLimit(mockRequest as Request, mockBrokenResponse as Response, mockNext);
      }).not.toThrow();
    });
  });
});