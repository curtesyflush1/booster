import { redisService } from './redisService';
import { logger } from '../utils/logger';
import jwt from 'jsonwebtoken';

export interface TokenInfo {
  jti: string;
  userId: string;
  issuedAt: number;
  expiresAt: number;
}

/**
 * Token Blacklist Service for JWT revocation
 * Implements secure token revocation using Redis for high-performance lookups
 */
export class TokenBlacklistService {
  private static readonly TOKEN_BLACKLIST_PREFIX = 'blacklist:token:';
  private static readonly USER_BLACKLIST_PREFIX = 'blacklist:user:';

  /**
   * Extract token information from JWT
   * @param token - JWT token string
   * @returns Token information or null if invalid
   */
  private static extractTokenInfo(token: string): TokenInfo | null {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.jti || !decoded.sub || !decoded.iat || !decoded.exp) {
        return null;
      }

      return {
        jti: decoded.jti,
        userId: decoded.sub,
        issuedAt: decoded.iat * 1000, // Convert to milliseconds
        expiresAt: decoded.exp * 1000  // Convert to milliseconds
      };
    } catch (error) {
      logger.error('Failed to extract token info', {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Revoke a specific JWT token
   * @param token - JWT token to revoke
   * @returns Promise<boolean> - true if successfully revoked
   */
  static async revokeToken(token: string): Promise<boolean> {
    try {
      const tokenInfo = this.extractTokenInfo(token);
      if (!tokenInfo) {
        logger.warn('Cannot revoke invalid token');
        return false;
      }

      const now = Date.now();
      const expirationInSeconds = Math.max(0, Math.floor((tokenInfo.expiresAt - now) / 1000));

      if (expirationInSeconds <= 0) {
        logger.debug('Token already expired, no need to blacklist', { jti: tokenInfo.jti });
        return true;
      }

      await redisService.blacklistToken(tokenInfo.jti, expirationInSeconds);
      
      logger.info('Token successfully revoked', {
        jti: tokenInfo.jti,
        userId: tokenInfo.userId,
        expiresIn: expirationInSeconds
      });

      return true;
    } catch (error) {
      logger.error('Failed to revoke token', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Check if a token is revoked
   * @param token - JWT token to check
   * @returns Promise<boolean> - true if token is revoked
   */
  static async isTokenRevoked(token: string): Promise<boolean> {
    try {
      const tokenInfo = this.extractTokenInfo(token);
      if (!tokenInfo) {
        logger.debug('Invalid token considered revoked');
        return true;
      }

      // Check if specific token is blacklisted
      const isTokenBlacklisted = await redisService.isTokenBlacklisted(tokenInfo.jti);
      if (isTokenBlacklisted) {
        return true;
      }

      // Check if all user tokens are blacklisted (e.g., after password change)
      const areUserTokensBlacklisted = await redisService.areUserTokensBlacklisted(
        tokenInfo.userId, 
        tokenInfo.issuedAt
      );

      return areUserTokensBlacklisted;
    } catch (error) {
      logger.error('Failed to check token revocation status', {
        error: error instanceof Error ? error.message : String(error)
      });
      // Fail secure - consider token revoked if we can't check
      return true;
    }
  }

  /**
   * Revoke all tokens for a user (useful for password changes, account suspension)
   * @param userId - User ID
   * @param reason - Reason for revocation (for logging)
   * @returns Promise<boolean> - true if successfully revoked
   */
  static async revokeAllUserTokens(userId: string, reason: string = 'manual_revocation'): Promise<boolean> {
    try {
      // Blacklist all future tokens for this user for 24 hours
      // This covers the maximum JWT expiration time
      const expirationInSeconds = 24 * 60 * 60; // 24 hours
      
      await redisService.blacklistAllUserTokens(userId, expirationInSeconds);
      
      logger.info('All user tokens revoked', {
        userId,
        reason,
        expiresIn: expirationInSeconds
      });

      return true;
    } catch (error) {
      logger.error('Failed to revoke all user tokens', {
        userId,
        reason,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Revoke user's refresh tokens (for logout)
   * @param userId - User ID
   * @param refreshToken - Specific refresh token to revoke
   * @returns Promise<boolean> - true if successfully revoked
   */
  static async revokeRefreshToken(userId: string, refreshToken: string): Promise<boolean> {
    try {
      const success = await this.revokeToken(refreshToken);
      
      if (success) {
        logger.info('Refresh token revoked', { userId });
      }

      return success;
    } catch (error) {
      logger.error('Failed to revoke refresh token', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Clean up expired blacklist entries (maintenance task)
   * This is handled automatically by Redis TTL, but can be called for monitoring
   * @returns Promise<number> - number of entries cleaned up
   */
  static async cleanupExpiredEntries(): Promise<number> {
    try {
      // Get all blacklist keys
      const tokenKeys = await redisService.keys(`${this.TOKEN_BLACKLIST_PREFIX}*`);
      const userKeys = await redisService.keys(`${this.USER_BLACKLIST_PREFIX}*`);
      
      let cleanedUp = 0;
      
      // Check TTL for each key and count expired ones
      for (const key of [...tokenKeys, ...userKeys]) {
        const ttl = await redisService.getClient().ttl(key);
        if (ttl === -2) { // Key doesn't exist (expired)
          cleanedUp++;
        }
      }

      logger.info('Blacklist cleanup completed', {
        totalKeys: tokenKeys.length + userKeys.length,
        cleanedUp
      });

      return cleanedUp;
    } catch (error) {
      logger.error('Failed to cleanup expired blacklist entries', {
        error: error instanceof Error ? error.message : String(error)
      });
      return 0;
    }
  }

  /**
   * Track a token for a user
   * @param userId - User ID
   * @param token - JWT token to track
   * @returns Promise<boolean> - true if successfully tracked
   */
  static async trackUserToken(userId: string, token: string): Promise<boolean> {
    try {
      const tokenInfo = this.extractTokenInfo(token);
      if (!tokenInfo) {
        logger.warn('Cannot track invalid token');
        return false;
      }

      await redisService.sadd(`user:tokens:${userId}`, tokenInfo.jti);
      
      logger.info('Token tracked for user', {
        userId,
        jti: tokenInfo.jti
      });

      return true;
    } catch (error) {
      logger.error('Failed to track user token', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Untrack a token for a user
   * @param userId - User ID
   * @param token - JWT token to untrack
   * @returns Promise<boolean> - true if successfully untracked
   */
  static async untrackUserToken(userId: string, token: string): Promise<boolean> {
    try {
      const tokenInfo = this.extractTokenInfo(token);
      if (!tokenInfo) {
        logger.warn('Cannot untrack invalid token');
        return false;
      }

      await redisService.srem(`user:tokens:${userId}`, tokenInfo.jti);
      
      logger.info('Token untracked for user', {
        userId,
        jti: tokenInfo.jti
      });

      return true;
    } catch (error) {
      logger.error('Failed to untrack user token', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Get blacklist information for a token
   * @param token - JWT token to check
   * @returns Promise<any> - blacklist information
   */
  static async getBlacklistInfo(token: string): Promise<any> {
    try {
      const tokenInfo = this.extractTokenInfo(token);
      if (!tokenInfo) {
        return { isBlacklisted: true, reason: 'Invalid token' };
      }

      const isTokenBlacklisted = await redisService.isTokenBlacklisted(tokenInfo.jti);
      const areUserTokensBlacklisted = await redisService.areUserTokensBlacklisted(
        tokenInfo.userId, 
        tokenInfo.issuedAt
      );

      return {
        isBlacklisted: isTokenBlacklisted || areUserTokensBlacklisted,
        tokenInfo,
        reason: isTokenBlacklisted ? 'Token blacklisted' : areUserTokensBlacklisted ? 'User tokens blacklisted' : 'Not blacklisted'
      };
    } catch (error) {
      logger.error('Failed to get blacklist info', {
        error: error instanceof Error ? error.message : String(error)
      });
      return { isBlacklisted: true, reason: 'Error checking blacklist' };
    }
  }

  /**
   * Get blacklist statistics for monitoring
   * @returns Promise<object> - blacklist statistics
   */
  static async getBlacklistStats(): Promise<{
    totalTokensBlacklisted: number;
    totalUsersBlacklisted: number;
    oldestEntry: string | null;
    newestEntry: string | null;
  }> {
    try {
      const tokenKeys = await redisService.keys(`${this.TOKEN_BLACKLIST_PREFIX}*`);
      const userKeys = await redisService.keys(`${this.USER_BLACKLIST_PREFIX}*`);

      // Get timestamps for oldest and newest entries
      let oldestEntry: string | null = null;
      let newestEntry: string | null = null;

      if (userKeys.length > 0) {
        const timestamps = await Promise.all(
          userKeys.map(async (key) => {
            const timestamp = await redisService.get(key);
            return timestamp ? parseInt(timestamp, 10) : 0;
          })
        );

        const validTimestamps = timestamps.filter(t => t > 0);
        if (validTimestamps.length > 0) {
          const oldest = Math.min(...validTimestamps);
          const newest = Math.max(...validTimestamps);
          oldestEntry = new Date(oldest).toISOString();
          newestEntry = new Date(newest).toISOString();
        }
      }

      return {
        totalTokensBlacklisted: tokenKeys.length,
        totalUsersBlacklisted: userKeys.length,
        oldestEntry,
        newestEntry
      };
    } catch (error) {
      logger.error('Failed to get blacklist statistics', {
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        totalTokensBlacklisted: 0,
        totalUsersBlacklisted: 0,
        oldestEntry: null,
        newestEntry: null
      };
    }
  }
  // Instance methods for test compatibility
  async blacklistToken(token: string, reason: string = 'manual_blacklist'): Promise<boolean> {
    return TokenBlacklistService.revokeToken(token);
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    return TokenBlacklistService.isTokenRevoked(token);
  }

  async blacklistAllUserTokens(userId: string, reason: string = 'manual_blacklist'): Promise<boolean> {
    return TokenBlacklistService.revokeAllUserTokens(userId, reason);
  }

  async trackUserToken(userId: string, token: string): Promise<boolean> {
    return TokenBlacklistService.trackUserToken(userId, token);
  }

  async untrackUserToken(userId: string, token: string): Promise<boolean> {
    return TokenBlacklistService.untrackUserToken(userId, token);
  }

  async getBlacklistInfo(token: string): Promise<any> {
    return TokenBlacklistService.getBlacklistInfo(token);
  }

  async cleanupExpiredEntries(): Promise<number> {
    return TokenBlacklistService.cleanupExpiredEntries();
  }

  async getBlacklistStats(): Promise<{
    totalTokensBlacklisted: number;
    totalUsersBlacklisted: number;
    oldestEntry: string | null;
    newestEntry: string | null;
  }> {
    return TokenBlacklistService.getBlacklistStats();
  }
}

// Export singleton instance for tests and other modules
export const tokenBlacklistService = new TokenBlacklistService();