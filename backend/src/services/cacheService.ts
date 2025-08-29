import { logger } from '../utils/logger';

/**
 * Cache service interface for different cache implementations
 */
export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  flush(): Promise<void>;
  mget<T>(keys: string[]): Promise<(T | null)[]>;
  mset<T>(keyValuePairs: Array<{ key: string; value: T; ttl?: number }>): Promise<void>;
}

/**
 * In-memory cache implementation for development/testing
 */
class MemoryCacheService implements ICacheService {
  private cache = new Map<string, { value: any; expires: number }>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> {
    const expires = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { value, expires });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  async flush(): Promise<void> {
    this.cache.clear();
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    return Promise.all(keys.map(key => this.get<T>(key)));
  }

  async mset<T>(keyValuePairs: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    for (const { key, value, ttl } of keyValuePairs) {
      await this.set(key, value, ttl);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

/**
 * Redis cache service implementation (placeholder for when Redis is available)
 */
class RedisCacheService implements ICacheService {
  private redis: any; // Redis client would be injected here

  constructor(redisClient?: any) {
    this.redis = redisClient;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;
    
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis get error', error, { key });
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> {
    if (!this.redis) return;

    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      logger.error('Redis set error', error, { key, ttlSeconds });
    }
  }

  async del(key: string): Promise<void> {
    if (!this.redis) return;

    try {
      await this.redis.del(key);
    } catch (error) {
      logger.error('Redis del error', error, { key });
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.redis) return false;

    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis exists error', error, { key });
      return false;
    }
  }

  async flush(): Promise<void> {
    if (!this.redis) return;

    try {
      await this.redis.flushall();
    } catch (error) {
      logger.error('Redis flush error', error);
    }
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (!this.redis || keys.length === 0) return [];

    try {
      const values = await this.redis.mget(keys);
      return values.map((value: string | null) => 
        value ? JSON.parse(value) : null
      );
    } catch (error) {
      logger.error('Redis mget error', error, { keys });
      return keys.map(() => null);
    }
  }

  async mset<T>(keyValuePairs: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    if (!this.redis || keyValuePairs.length === 0) return;

    try {
      const pipeline = this.redis.pipeline();
      
      for (const { key, value, ttl = 300 } of keyValuePairs) {
        pipeline.setex(key, ttl, JSON.stringify(value));
      }
      
      await pipeline.exec();
    } catch (error) {
      logger.error('Redis mset error', error, { count: keyValuePairs.length });
    }
  }
}

/**
 * Cache service factory and main interface
 */
export class CacheService {
  private static instance: ICacheService;

  /**
   * Initialize cache service with appropriate implementation
   */
  static initialize(redisClient?: any): void {
    if (redisClient) {
      this.instance = new RedisCacheService(redisClient);
      logger.info('Cache service initialized with Redis');
    } else {
      this.instance = new MemoryCacheService();
      logger.info('Cache service initialized with in-memory cache');
    }
  }

  /**
   * Get cache service instance
   */
  static getInstance(): ICacheService {
    if (!this.instance) {
      this.initialize(); // Initialize with memory cache as fallback
    }
    return this.instance;
  }

  /**
   * Create cache key with namespace
   */
  static createKey(namespace: string, ...parts: string[]): string {
    return `${namespace}:${parts.join(':')}`;
  }

  /**
   * Cached function wrapper
   */
  static cached<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    options: {
      keyGenerator: (...args: T) => string;
      ttlSeconds?: number;
      namespace?: string;
    }
  ) {
    return async (...args: T): Promise<R> => {
      const cache = this.getInstance();
      const key = options.namespace 
        ? this.createKey(options.namespace, options.keyGenerator(...args))
        : options.keyGenerator(...args);

      // Try to get from cache first
      const cached = await cache.get<R>(key);
      if (cached !== null) {
        return cached;
      }

      // Execute function and cache result
      const result = await fn(...args);
      await cache.set(key, result, options.ttlSeconds);
      
      return result;
    };
  }
}

// Initialize with memory cache by default
CacheService.initialize();