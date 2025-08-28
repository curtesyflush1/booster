import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';
import { HTTP_TIMEOUTS } from '../constants';

// Redis error types for better error handling
export enum RedisErrorType {
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  COMMAND_ERROR = 'COMMAND_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export class RedisError extends Error {
  public readonly type: RedisErrorType;
  public readonly originalError?: Error;

  constructor(message: string, type: RedisErrorType, originalError?: Error) {
    super(message);
    this.name = 'RedisError';
    this.type = type;
    this.originalError = originalError;
  }
}

// Helper function to classify Redis errors
export function classifyRedisError(error: any): RedisErrorType {
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return RedisErrorType.CONNECTION_ERROR;
  }
  if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
    return RedisErrorType.TIMEOUT_ERROR;
  }
  if (error.name === 'ReplyError') {
    return RedisErrorType.COMMAND_ERROR;
  }
  return RedisErrorType.UNKNOWN_ERROR;
}

export class RedisService {
  private client: RedisClientType;
  private isConnected = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    this.client = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis connection failed after 10 retries');
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 50, 1000);
        },
        connectTimeout: HTTP_TIMEOUTS.REDIS_CONNECT_TIMEOUT,
        keepAlive: HTTP_TIMEOUTS.REDIS_KEEPALIVE
      },
      // Connection pool configuration for better performance
      isolationPoolOptions: {
        min: 2,
        max: 10
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info('Redis client connecting...');
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready');
      this.isConnected = true;
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error', { error: error.message });
      this.isConnected = false;
    });

    this.client.on('end', () => {
      logger.info('Redis client disconnected');
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      try {
        await this.client.connect();
        logger.info('Redis connection established');
      } catch (error) {
        logger.error('Failed to connect to Redis', { 
          error: error instanceof Error ? error.message : String(error) 
        });
        throw error;
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      try {
        await this.client.disconnect();
        logger.info('Redis connection closed');
      } catch (error) {
        logger.error('Error disconnecting from Redis', { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }
  }

  /**
   * Set a key-value pair with optional expiration
   */
  async set(key: string, value: string, expirationInSeconds?: number): Promise<void> {
    try {
      if (expirationInSeconds) {
        await this.client.setEx(key, expirationInSeconds, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      logger.error('Redis SET operation failed', { 
        key, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Get value by key
   */
  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error('Redis GET operation failed', { 
        key, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Delete a key
   */
  async del(key: string): Promise<number> {
    try {
      return await this.client.del(key);
    } catch (error) {
      logger.error('Redis DEL operation failed', { 
        key, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXISTS operation failed', { 
        key, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Set expiration for a key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const result = await this.client.expire(key, seconds);
      return result;
    } catch (error) {
      logger.error('Redis EXPIRE operation failed', { 
        key, 
        seconds,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Get keys matching a pattern
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      logger.error('Redis KEYS operation failed', { 
        pattern, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Add member to a set
   */
  async sadd(key: string, member: string): Promise<number> {
    try {
      return await this.client.sAdd(key, member);
    } catch (error) {
      logger.error('Redis SADD operation failed', { 
        key, 
        member,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Check if member exists in set
   */
  async sismember(key: string, member: string): Promise<boolean> {
    try {
      return await this.client.sIsMember(key, member);
    } catch (error) {
      logger.error('Redis SISMEMBER operation failed', { 
        key, 
        member,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Remove member from set
   */
  async srem(key: string, member: string): Promise<number> {
    try {
      return await this.client.sRem(key, member);
    } catch (error) {
      logger.error('Redis SREM operation failed', { 
        key, 
        member,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Get all members of a set
   */
  async smembers(key: string): Promise<string[]> {
    try {
      return await this.client.sMembers(key);
    } catch (error) {
      logger.error('Redis SMEMBERS operation failed', { 
        key,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Health check
   */
  async ping(): Promise<string> {
    try {
      return await this.client.ping();
    } catch (error) {
      logger.error('Redis PING failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Get connection status
   */
  isReady(): boolean {
    return this.isConnected && this.client.isReady;
  }

  /**
   * Get Redis client instance (for advanced operations)
   */
  getClient(): RedisClientType {
    return this.client;
  }

  // Token Blacklist Methods for JWT Revocation
  
  // Caching Utilities
  
  /**
   * Cache JSON data with automatic serialization
   * @param key - Cache key
   * @param data - Data to cache (will be JSON stringified)
   * @param expirationInSeconds - Optional expiration time
   */
  async setJSON<T>(key: string, data: T, expirationInSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(data);
      await this.set(key, serialized, expirationInSeconds);
    } catch (error) {
      logger.error('Redis JSON SET operation failed', { 
        key, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Get and parse JSON data from cache
   * @param key - Cache key
   * @returns Parsed JSON data or null if not found
   */
  async getJSON<T>(key: string): Promise<T | null> {
    try {
      const data = await this.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (error) {
      logger.error('Redis JSON GET operation failed', { 
        key, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Cache with automatic refresh - get data or execute function if not cached
   * @param key - Cache key
   * @param fetchFunction - Function to execute if cache miss
   * @param expirationInSeconds - Cache expiration time
   * @returns Cached or freshly fetched data
   */
  async getOrSet<T>(
    key: string, 
    fetchFunction: () => Promise<T>, 
    expirationInSeconds: number = 3600
  ): Promise<T> {
    try {
      // Try to get from cache first
      const cached = await this.getJSON<T>(key);
      if (cached !== null) {
        return cached;
      }

      // Cache miss - fetch fresh data
      const freshData = await fetchFunction();
      await this.setJSON(key, freshData, expirationInSeconds);
      
      logger.debug('Cache miss - data fetched and cached', { key });
      return freshData;
    } catch (error) {
      logger.error('Redis getOrSet operation failed', { 
        key, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Add a JWT token to the blacklist
   * @param tokenId - Unique token identifier (jti claim)
   * @param expirationInSeconds - Token expiration time
   */
  async blacklistToken(tokenId: string, expirationInSeconds: number): Promise<void> {
    const key = `blacklist:token:${tokenId}`;
    await this.set(key, '1', expirationInSeconds);
    logger.info('Token added to blacklist', { tokenId, expiresIn: expirationInSeconds });
  }

  /**
   * Check if a token is blacklisted
   * @param tokenId - Unique token identifier (jti claim)
   * @returns Promise<boolean> - true if token is blacklisted
   */
  async isTokenBlacklisted(tokenId: string): Promise<boolean> {
    const key = `blacklist:token:${tokenId}`;
    return await this.exists(key);
  }

  /**
   * Blacklist all tokens for a specific user (useful for password changes)
   * @param userId - User ID
   * @param expirationInSeconds - How long to maintain the blacklist
   */
  async blacklistAllUserTokens(userId: string, expirationInSeconds: number = 86400): Promise<void> {
    const key = `blacklist:user:${userId}`;
    const timestamp = Date.now().toString();
    await this.set(key, timestamp, expirationInSeconds);
    logger.info('All user tokens blacklisted', { userId, timestamp });
  }

  /**
   * Check if all tokens for a user are blacklisted
   * @param userId - User ID
   * @param tokenIssuedAt - When the token was issued (timestamp)
   * @returns Promise<boolean> - true if user tokens are blacklisted after token issue time
   */
  async areUserTokensBlacklisted(userId: string, tokenIssuedAt: number): Promise<boolean> {
    const key = `blacklist:user:${userId}`;
    const blacklistTimestamp = await this.get(key);
    
    if (!blacklistTimestamp) return false;
    
    const blacklistTime = parseInt(blacklistTimestamp, 10);
    return tokenIssuedAt < blacklistTime;
  }

  // Rate Limiting Methods
  
  /**
   * Increment rate limit counter for a key
   * @param key - Rate limit key (e.g., 'api:user:123', 'login:ip:192.168.1.1')
   * @param windowInSeconds - Time window for rate limiting
   * @param maxRequests - Maximum requests allowed in the window
   * @returns Object with current count and whether limit is exceeded
   */
  async rateLimit(
    key: string, 
    windowInSeconds: number, 
    maxRequests: number
  ): Promise<{ count: number; isLimited: boolean; resetTime: number }> {
    try {
      const rateLimitKey = `ratelimit:${key}`;
      
      // Use Redis pipeline for atomic operations
      const pipeline = this.client.multi();
      pipeline.incr(rateLimitKey);
      pipeline.expire(rateLimitKey, windowInSeconds);
      
      const results = await pipeline.exec();
      const count = results?.[0] as number || 0;
      
      const resetTime = Date.now() + (windowInSeconds * 1000);
      const isLimited = count > maxRequests;
      
      if (isLimited) {
        logger.warn('Rate limit exceeded', { key, count, maxRequests, windowInSeconds });
      }
      
      return { count, isLimited, resetTime };
    } catch (error) {
      logger.error('Rate limit operation failed', { 
        key, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Get current rate limit status without incrementing
   * @param key - Rate limit key
   * @returns Current count and TTL
   */
  async getRateLimitStatus(key: string): Promise<{ count: number; ttl: number }> {
    try {
      const rateLimitKey = `ratelimit:${key}`;
      const pipeline = this.client.multi();
      pipeline.get(rateLimitKey);
      pipeline.ttl(rateLimitKey);
      
      const results = await pipeline.exec();
      const count = parseInt(results?.[0] as string || '0', 10);
      const ttl = results?.[1] as number || 0;
      
      return { count, ttl };
    } catch (error) {
      logger.error('Get rate limit status failed', { 
        key, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }
}

// Export singleton instance
export const redisService = new RedisService();