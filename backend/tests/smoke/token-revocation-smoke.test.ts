import { TokenBlacklistService } from '../../src/services/tokenBlacklistService';
import { redisService } from '../../src/services/redisService';
import jwt from 'jsonwebtoken';

// Mock Redis for smoke test
jest.mock('../../src/services/redisService');
const mockRedisService = redisService as jest.Mocked<typeof redisService>;

describe('Token Revocation Smoke Test', () => {
  const mockUserId = 'test-user-123';
  const jwtSecret = 'test-secret';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup basic Redis mocks
    mockRedisService.blacklistToken.mockResolvedValue();
    mockRedisService.isTokenBlacklisted.mockResolvedValue(false);
  });

  it('should revoke tokens correctly', async () => {
    // Create a test token with jti claim
    const token = jwt.sign(
      { 
        sub: mockUserId, 
        jti: 'test-jti-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      }, 
      jwtSecret
    );
    
    // Revoke the token
    const result = await TokenBlacklistService.revokeToken(token);
    
    expect(result).toBe(true);
    expect(mockRedisService.blacklistToken).toHaveBeenCalled();
  });

  it('should detect revoked tokens', async () => {
    const token = jwt.sign(
      { 
        sub: mockUserId, 
        jti: 'test-jti-456',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      }, 
      jwtSecret
    );
    
    // Mock token as blacklisted
    mockRedisService.isTokenBlacklisted.mockResolvedValue(true);
    
    const isRevoked = await TokenBlacklistService.isTokenRevoked(token);
    
    expect(isRevoked).toBe(true);
    expect(mockRedisService.isTokenBlacklisted).toHaveBeenCalled();
  });

  it('should fail secure when Redis is unavailable', async () => {
    const token = jwt.sign(
      { 
        sub: mockUserId, 
        jti: 'test-jti-789',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      }, 
      jwtSecret
    );
    
    // Mock Redis error
    mockRedisService.isTokenBlacklisted.mockRejectedValue(new Error('Redis unavailable'));
    
    // Should return true (fail secure)
    const isRevoked = await TokenBlacklistService.isTokenRevoked(token);
    expect(isRevoked).toBe(true);
  });
});