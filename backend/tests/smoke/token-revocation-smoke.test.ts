import { authService } from '../../src/services/authService';
import { tokenBlacklistService } from '../../src/services/tokenBlacklistService';
import { redisService } from '../../src/services/redisService';
import jwt from 'jsonwebtoken';

// Mock Redis for smoke test
jest.mock('../../src/services/redisService');
const mockRedisService = redisService as jest.Mocked<typeof redisService>;

describe('Token Revocation Smoke Test', () => {
  const mockUserId = 'test-user-123';
  const jwtSecret = 'test-secret';
  const jwtRefreshSecret = 'test-refresh-secret';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup basic Redis mocks
    mockRedisService.exists.mockResolvedValue(false);
    mockRedisService.set.mockResolvedValue();
    mockRedisService.sadd.mockResolvedValue(1);
    mockRedisService.expire.mockResolvedValue(true);
    mockRedisService.smembers.mockResolvedValue([]);
    mockRedisService.del.mockResolvedValue(1);
  });

  it('should blacklist tokens correctly', async () => {
    // Create a test token
    const token = jwt.sign({ userId: mockUserId }, jwtSecret, { expiresIn: '1h' });
    
    // Blacklist the token
    await tokenBlacklistService.blacklistToken(token, 'test_logout');
    
    // Verify Redis set was called with correct parameters
    expect(mockRedisService.set).toHaveBeenCalledWith(
      expect.stringContaining('blacklist:token:'),
      expect.stringContaining(mockUserId),
      expect.any(Number)
    );
  });

  it('should detect blacklisted tokens', async () => {
    const token = jwt.sign({ userId: mockUserId }, jwtSecret, { expiresIn: '1h' });
    
    // Mock token as blacklisted
    mockRedisService.exists.mockResolvedValue(true);
    
    const isBlacklisted = await tokenBlacklistService.isTokenBlacklisted(token);
    
    expect(isBlacklisted).toBe(true);
    expect(mockRedisService.exists).toHaveBeenCalledWith(
      expect.stringContaining('blacklist:token:')
    );
  });

  it('should track user tokens for bulk revocation', async () => {
    const token = jwt.sign({ userId: mockUserId }, jwtSecret, { expiresIn: '1h' });
    
    await tokenBlacklistService.trackUserToken(mockUserId, token);
    
    expect(mockRedisService.sadd).toHaveBeenCalledWith(
      `user:tokens:${mockUserId}`,
      token
    );
    expect(mockRedisService.expire).toHaveBeenCalledWith(
      `user:tokens:${mockUserId}`,
      expect.any(Number)
    );
  });

  it('should blacklist all user tokens', async () => {
    const tokens = [
      jwt.sign({ userId: mockUserId }, jwtSecret, { expiresIn: '1h' }),
      jwt.sign({ userId: mockUserId }, jwtRefreshSecret, { expiresIn: '7d' })
    ];
    
    mockRedisService.smembers.mockResolvedValue(tokens);
    
    await tokenBlacklistService.blacklistAllUserTokens(mockUserId, 'password_change');
    
    // Should get user tokens
    expect(mockRedisService.smembers).toHaveBeenCalledWith(`user:tokens:${mockUserId}`);
    
    // Should blacklist each token
    expect(mockRedisService.set).toHaveBeenCalledTimes(tokens.length);
    
    // Should clear user token set
    expect(mockRedisService.del).toHaveBeenCalledWith(`user:tokens:${mockUserId}`);
  });

  it('should fail secure when Redis is unavailable', async () => {
    const token = jwt.sign({ userId: mockUserId }, jwtSecret, { expiresIn: '1h' });
    
    // Mock Redis error
    mockRedisService.exists.mockRejectedValue(new Error('Redis unavailable'));
    
    // Should return true (fail secure)
    const isBlacklisted = await tokenBlacklistService.isTokenBlacklisted(token);
    expect(isBlacklisted).toBe(true);
  });

  it('should handle token expiry correctly', async () => {
    // Create an expired token
    const expiredToken = jwt.sign({ userId: mockUserId }, jwtSecret, { expiresIn: '-1h' });
    
    // Should not attempt to blacklist expired tokens
    await tokenBlacklistService.blacklistToken(expiredToken, 'test');
    
    // Redis set should not be called for expired tokens
    expect(mockRedisService.set).not.toHaveBeenCalled();
  });

  it('should generate consistent token keys', async () => {
    const token = jwt.sign({ userId: mockUserId }, jwtSecret, { expiresIn: '1h' });
    
    // Blacklist the same token twice
    await tokenBlacklistService.blacklistToken(token, 'test1');
    await tokenBlacklistService.blacklistToken(token, 'test2');
    
    // Should use the same key both times
    const calls = mockRedisService.set.mock.calls;
    expect(calls[0][0]).toBe(calls[1][0]); // Same key
  });

  it('should handle malformed tokens gracefully', async () => {
    const malformedToken = 'not.a.valid.jwt.token';
    
    await expect(tokenBlacklistService.blacklistToken(malformedToken))
      .rejects.toThrow('Invalid token format');
  });

  it('should provide blacklist statistics', async () => {
    const keys = ['blacklist:token:key1', 'blacklist:token:key2'];
    const activeEntry = {
      userId: mockUserId,
      blacklistedAt: Math.floor(Date.now() / 1000),
      expiresAt: Math.floor(Date.now() / 1000) + 3600
    };
    
    mockRedisService.keys.mockResolvedValue(keys);
    mockRedisService.get.mockResolvedValue(JSON.stringify(activeEntry));
    
    const stats = await tokenBlacklistService.getBlacklistStats();
    
    expect(stats.totalBlacklistedTokens).toBe(2);
    expect(stats.activeBlacklistedTokens).toBe(2);
  });
});