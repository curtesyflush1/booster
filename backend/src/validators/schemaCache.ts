import Joi from 'joi';
import { logger } from '../utils/logger';

/**
 * Schema compilation cache to improve validation performance
 * Compiled schemas are cached to avoid recompilation on every request
 */
class SchemaCache {
  private cache = new Map<string, Joi.ObjectSchema>();
  private hitCount = 0;
  private missCount = 0;

  /**
   * Get or compile and cache a schema
   */
  getCompiledSchema(key: string, schema: Joi.ObjectSchema): Joi.ObjectSchema {
    if (this.cache.has(key)) {
      this.hitCount++;
      return this.cache.get(key)!;
    }

    // Cache the schema directly (Joi schemas are already compiled)
    this.cache.set(key, schema);
    this.missCount++;

    logger.debug('Schema cached', { key, cacheSize: this.cache.size });
    return schema;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: this.hitCount / (this.hitCount + this.missCount) || 0
    };
  }

  /**
   * Clear the cache (useful for testing)
   */
  clear() {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Generate cache key for schema
   */
  static generateKey(schemaName: string, schemaType: 'body' | 'query' | 'params'): string {
    return `${schemaName}:${schemaType}`;
  }
}

export const schemaCache = new SchemaCache();