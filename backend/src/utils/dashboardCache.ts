import { logger } from './logger';

/**
 * Dashboard-specific caching utilities
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class DashboardCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get cached data if valid
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    logger.debug('Cache hit', { key, age: now - entry.timestamp });
    return entry.data;
  }

  /**
   * Set cached data with TTL
   */
  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });

    logger.debug('Cache set', { key, ttl });
  }

  /**
   * Generate cache key for user dashboard data
   */
  getDashboardKey(userId: string): string {
    return `dashboard:${userId}`;
  }

  /**
   * Generate cache key for user portfolio data
   */
  getPortfolioKey(userId: string): string {
    return `portfolio:${userId}`;
  }

  /**
   * Generate cache key for predictive insights
   */
  getInsightsKey(userId: string, productIds?: string[]): string {
    const productKey = productIds ? productIds.sort().join(',') : 'all';
    return `insights:${userId}:${productKey}`;
  }

  /**
   * Clear all cache entries for a user
   */
  clearUserCache(userId: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (key.includes(userId)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    logger.debug('User cache cleared', { userId, keysCleared: keysToDelete.length });
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

export const dashboardCache = new DashboardCache();