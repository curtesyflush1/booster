import jwt from 'jsonwebtoken';
import { tokenBlacklistService } from '../../src/services/tokenBlacklistService';
import { redisService } from '../../src/services/redisService';

// Mock Redis service
jest.mock('../../src/services/redisService');
const mockRedisService = redisService as jest.Mocked<typeof redisService>;

describe('TokenBlacklistService', () => {
  const mockUserId = 'user-123';
  const mockJwtSecret = 'test-secret';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockToken = (userId: string, expiresIn: string = '1h'): string => {
    return jwt.sign({ userId }, mockJwtSecret, { expiresIn } as jwt.SignOptions);
  };

  describe('blacklistToken', () => {
    it('should blacklist a valid token', async () => {
      const token = createMockToken(mockUserId);
      mockRedisService.set.mockResolvedValue();
      mockRedisService.exists.mockResolvedValue(false);

      await tokenBlacklistService.blacklistToken(token, 'test_reason');

      expect(mockRedisService.set).toHaveBeenCalledWith(
        expect.stringContaining('blacklist:token:'),
        expect.stringContaining(mockUserId),
        expect.any(Number)
      );
    });

    it('should not blacklist an already expired token', async () => {
      const expiredToken = jwt.sign({ userId: mockUserId }, mockJwtSecret, { expiresIn: '-1h' });
      
      await tokenBlacklistService.blacklistToken(expiredToken, 'test_reason');

      expect(mockRedisService.set).not.toHaveBeenCalled();
    });

    it('should handle invalid tokens gracefully', async () => {
      const invalidToken = 'invalid.token.here';

      await expect(tokenBlacklistService.blacklistToken(invalidToken))
        .rejects.toThrow('Invalid token format');
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return true for blacklisted tokens', async () => {
      const token = createMockToken(mockUserId);
      mockRedisService.exists.mockResolvedValue(true);

      const result = await tokenBlacklistService.isTokenBlacklisted(token);

      expect(result).toBe(true);
      expect(mockRedisService.exists).toHaveBeenCalledWith(
        expect.stringContaining('blacklist:token:')
      );
    });

    it('should return false for non-blacklisted tokens', async () => {
      const token = createMockToken(mockUserId);
      mockRedisService.exists.mockResolvedValue(false);

      const result = await tokenBlacklistService.isTokenBlacklisted(token);

      expect(result).toBe(false);
    });

    it('should return true on Redis errors (fail secure)', async () => {
      const token = createMockToken(mockUserId);
      mockRedisService.exists.mockRejectedValue(new Error('Redis error'));

      const result = await tokenBlacklistService.isTokenBlacklisted(token);

      expect(result).toBe(true);
    });
  });

  describe('blacklistAllUserTokens', () => {
    it('should blacklist all tokens for a user', async () => {
      const tokens = [
        createMockToken(mockUserId),
        createMockToken(mockUserId),
        createMockToken(mockUserId)
      ];
      
      mockRedisService.smembers.mockResolvedValue(tokens);
      mockRedisService.set.mockResolvedValue();
      mockRedisService.del.mockResolvedValue(1);

      await tokenBlacklistService.blacklistAllUserTokens(mockUserId, 'test_reason');

      expect(mockRedisService.smembers).toHaveBeenCalledWith(`user:tokens:${mockUserId}`);
      expect(mockRedisService.set).toHaveBeenCalledTimes(tokens.length);
      expect(mockRedisService.del).toHaveBeenCalledWith(`user:tokens:${mockUserId}`);
    });

    it('should handle empty token list', async () => {
      mockRedisService.smembers.mockResolvedValue([]);
      mockRedisService.del.mockResolvedValue(0);

      await tokenBlacklistService.blacklistAllUserTokens(mockUserId);

      expect(mockRedisService.set).not.toHaveBeenCalled();
      expect(mockRedisService.del).toHaveBeenCalledWith(`user:tokens:${mockUserId}`);
    });
  });

  describe('trackUserToken', () => {
    it('should track a token for a user', async () => {
      const token = createMockToken(mockUserId);
      mockRedisService.sadd.mockResolvedValue(1);
      mockRedisService.expire.mockResolvedValue(true);

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

    it('should not fail if tracking fails', async () => {
      const token = createMockToken(mockUserId);
      mockRedisService.sadd.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(tokenBlacklistService.trackUserToken(mockUserId, token))
        .resolves.not.toThrow();
    });
  });

  describe('untrackUserToken', () => {
    it('should remove a token from user tracking', async () => {
      const token = createMockToken(mockUserId);
      mockRedisService.srem.mockResolvedValue(1);

      await tokenBlacklistService.untrackUserToken(mockUserId, token);

      expect(mockRedisService.srem).toHaveBeenCalledWith(
        `user:tokens:${mockUserId}`,
        token
      );
    });

    it('should not fail if untracking fails', async () => {
      const token = createMockToken(mockUserId);
      mockRedisService.srem.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(tokenBlacklistService.untrackUserToken(mockUserId, token))
        .resolves.not.toThrow();
    });
  });

  describe('getBlacklistInfo', () => {
    it('should return blacklist information for a token', async () => {
      const token = createMockToken(mockUserId);
      const blacklistInfo = {
        userId: mockUserId,
        blacklistedAt: Math.floor(Date.now() / 1000),
        reason: 'test_reason'
      };
      
      mockRedisService.get.mockResolvedValue(JSON.stringify(blacklistInfo));

      const result = await tokenBlacklistService.getBlacklistInfo(token);

      expect(result).toEqual(blacklistInfo);
    });

    it('should return null for non-blacklisted tokens', async () => {
      const token = createMockToken(mockUserId);
      mockRedisService.get.mockResolvedValue(null);

      const result = await tokenBlacklistService.getBlacklistInfo(token);

      expect(result).toBeNull();
    });

    it('should return null on errors', async () => {
      const token = createMockToken(mockUserId);
      mockRedisService.get.mockRejectedValue(new Error('Redis error'));

      const result = await tokenBlacklistService.getBlacklistInfo(token);

      expect(result).toBeNull();
    });
  });

  describe('cleanupExpiredEntries', () => {
    it('should clean up expired blacklist entries', async () => {
      const expiredEntry = {
        userId: mockUserId,
        blacklistedAt: Math.floor(Date.now() / 1000) - 3600,
        expiresAt: Math.floor(Date.now() / 1000) - 1800
      };
      
      const activeEntry = {
        userId: mockUserId,
        blacklistedAt: Math.floor(Date.now() / 1000),
        expiresAt: Math.floor(Date.now() / 1000) + 3600
      };

      mockRedisService.keys.mockResolvedValue(['key1', 'key2']);
      mockRedisService.get
        .mockResolvedValueOnce(JSON.stringify(expiredEntry))
        .mockResolvedValueOnce(JSON.stringify(activeEntry));
      mockRedisService.del.mockResolvedValue(1);

      const cleanedCount = await tokenBlacklistService.cleanupExpiredEntries();

      expect(cleanedCount).toBe(1);
      expect(mockRedisService.del).toHaveBeenCalledTimes(1);
    });
  });

  describe('getBlacklistStats', () => {
    it('should return blacklist statistics', async () => {
      const activeEntry = {
        userId: mockUserId,
        blacklistedAt: Math.floor(Date.now() / 1000),
        expiresAt: Math.floor(Date.now() / 1000) + 3600
      };

      mockRedisService.keys.mockResolvedValue(['key1', 'key2']);
      mockRedisService.get
        .mockResolvedValueOnce(JSON.stringify(activeEntry))
        .mockResolvedValueOnce(JSON.stringify(activeEntry));

      const stats = await tokenBlacklistService.getBlacklistStats();

      expect(stats).toEqual({
        totalBlacklistedTokens: 2,
        activeBlacklistedTokens: 2
      });
    });

    it('should handle errors gracefully', async () => {
      mockRedisService.keys.mockRejectedValue(new Error('Redis error'));

      const stats = await tokenBlacklistService.getBlacklistStats();

      expect(stats).toEqual({
        totalBlacklistedTokens: 0,
        activeBlacklistedTokens: 0
      });
    });
  });
});