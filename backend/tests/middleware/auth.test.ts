import { Request, Response, NextFunction } from 'express';
import { authenticate, requireSubscription, requireEmailVerification, optionalAuth } from '../../src/middleware/auth';
import { authService } from '../../src/services/authService';
import { SubscriptionTier } from '../../src/types/subscription';
import { createMockUser, createFreeUser, createProUser, createUnverifiedUser } from '../helpers/userTestHelpers';

// Mock dependencies
jest.mock('../../src/services/authService');
jest.mock('../../src/services/tokenBlacklistService', () => ({
  TokenBlacklistService: {
    isTokenRevoked: jest.fn().mockResolvedValue(false)
  }
}));
jest.mock('../../src/utils/logger', () => ({
  loggerWithContext: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  },
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

const mockedAuthService = authService as jest.Mocked<typeof authService>;

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

beforeEach(() => {
  // Ensure auth bypass is disabled for these unit tests
  process.env.TEST_BYPASS_AUTH = 'false';
    mockRequest = {
      headers: {}
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('authenticate middleware', () => {
    it('should authenticate valid token successfully', async () => {
      const mockUser = createMockUser();
      mockRequest.headers = {
        authorization: 'Bearer valid-token'
      };
      mockedAuthService.validateAccessToken.mockResolvedValue(mockUser);

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockedAuthService.validateAccessToken).toHaveBeenCalledWith('valid-token');
      expect(mockRequest.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject request without authorization header', async () => {
      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authentication token is required',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with invalid authorization format', async () => {
      mockRequest.headers = {
        authorization: 'Invalid format'
      };

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authentication token is required',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token'
      };
      mockedAuthService.validateAccessToken.mockRejectedValue(new Error('Invalid token'));

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired authentication token',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle empty Bearer token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer '
      };

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireSubscription middleware', () => {
    it('should allow free user to access free tier features', () => {
      const freeUser = createMockUser({ subscription_tier: SubscriptionTier.FREE });
      mockRequest.user = freeUser;
      const middleware = requireSubscription(SubscriptionTier.FREE);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow pro user to access free tier features', () => {
      const proUser = createMockUser({ subscription_tier: SubscriptionTier.PRO });
      mockRequest.user = proUser;
      const middleware = requireSubscription(SubscriptionTier.FREE);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow pro user to access pro tier features', () => {
      const proUser = createMockUser({ subscription_tier: SubscriptionTier.PRO });
      mockRequest.user = proUser;
      const middleware = requireSubscription(SubscriptionTier.PRO);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject free user from pro tier features', () => {
      const freeUser = createMockUser({ subscription_tier: SubscriptionTier.FREE });
      mockRequest.user = freeUser;
      const middleware = requireSubscription(SubscriptionTier.PRO);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'INSUFFICIENT_SUBSCRIPTION',
          message: `This feature requires ${SubscriptionTier.PRO} subscription`,
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject unauthenticated requests', () => {
      const middleware = requireSubscription(SubscriptionTier.FREE);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireEmailVerification middleware', () => {
    it('should allow verified user to proceed', () => {
      const verifiedUser = createMockUser({ email_verified: true });
      mockRequest.user = verifiedUser;

      requireEmailVerification(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject unverified user', () => {
      const unverifiedUser = createMockUser({ email_verified: false });
      mockRequest.user = unverifiedUser;

      requireEmailVerification(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Email verification is required to access this feature',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject unauthenticated requests', () => {
      requireEmailVerification(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth middleware', () => {
    it('should authenticate valid token and set user', async () => {
      const mockUser = createMockUser();
      mockRequest.headers = {
        authorization: 'Bearer valid-token'
      };
      mockedAuthService.validateAccessToken.mockResolvedValue(mockUser);

      await optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockedAuthService.validateAccessToken).toHaveBeenCalledWith('valid-token');
      expect(mockRequest.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should proceed without authentication when no token provided', async () => {
      await optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockedAuthService.validateAccessToken).not.toHaveBeenCalled();
      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should proceed without authentication when invalid token provided', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token'
      };
      mockedAuthService.validateAccessToken.mockRejectedValue(new Error('Invalid token'));

      await optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockedAuthService.validateAccessToken).toHaveBeenCalledWith('invalid-token');
      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should handle malformed authorization header gracefully', async () => {
      mockRequest.headers = {
        authorization: 'Invalid format'
      };

      await optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockedAuthService.validateAccessToken).not.toHaveBeenCalled();
      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });
});
