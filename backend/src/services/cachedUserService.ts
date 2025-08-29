import { User } from '../models/User';
import { IUser } from '../types/database';
import { CacheService } from './cacheService';
import { logger } from '../utils/logger';

/**
 * Cached user service for improved performance
 */
export class CachedUserService {
  private static readonly CACHE_TTL = 300; // 5 minutes
  private static readonly CACHE_NAMESPACE = 'user';

  /**
   * Get user with preferences from cache or database
   */
  static async getUserWithPreferences(userId: string): Promise<IUser | null> {
    const cache = CacheService.getInstance();
    const cacheKey = CacheService.createKey(this.CACHE_NAMESPACE, userId, 'preferences');
    
    try {
      // Try cache first
      const cached = await cache.get<IUser>(cacheKey);
      if (cached) {
        logger.debug('User data retrieved from cache', { userId });
        return cached;
      }

      // Fallback to database
      const user = await User.findByIdWithPermissions(userId);
      if (user) {
        await cache.set(cacheKey, user, this.CACHE_TTL);
        logger.debug('User data cached from database', { userId });
      }

      return user;
    } catch (error) {
      logger.error('Error in getUserWithPreferences', error, { userId });
      // Fallback to direct database query
      return User.findByIdWithPermissions(userId);
    }
  }

  /**
   * Get multiple users with caching
   */
  static async getUsersWithPreferences(userIds: string[]): Promise<Map<string, IUser>> {
    const cache = CacheService.getInstance();
    const result = new Map<string, IUser>();
    const uncachedIds: string[] = [];

    // Check cache for each user
    const cacheKeys = userIds.map(id => 
      CacheService.createKey(this.CACHE_NAMESPACE, id, 'preferences')
    );

    try {
      const cachedUsers = await cache.mget<IUser>(cacheKeys);
      
      userIds.forEach((userId, index) => {
        const cachedUser = cachedUsers[index];
        if (cachedUser) {
          result.set(userId, cachedUser);
        } else {
          uncachedIds.push(userId);
        }
      });

      // Fetch uncached users from database
      if (uncachedIds.length > 0) {
        const dbUsers = await this.fetchUsersFromDatabase(uncachedIds);
        
        // Cache the fetched users
        const cacheEntries = Array.from(dbUsers.entries()).map(([userId, user]) => ({
          key: CacheService.createKey(this.CACHE_NAMESPACE, userId, 'preferences'),
          value: user,
          ttl: this.CACHE_TTL
        }));

        if (cacheEntries.length > 0) {
          await cache.mset(cacheEntries);
        }

        // Add to result
        dbUsers.forEach((user, userId) => {
          result.set(userId, user);
        });
      }

      logger.debug('Bulk user retrieval completed', {
        total: userIds.length,
        cached: userIds.length - uncachedIds.length,
        fromDb: uncachedIds.length
      });

      return result;
    } catch (error) {
      logger.error('Error in getUsersWithPreferences', error, { userIds });
      // Fallback to database
      return this.fetchUsersFromDatabase(userIds);
    }
  }

  /**
   * Invalidate user cache
   */
  static async invalidateUserCache(userId: string): Promise<void> {
    const cache = CacheService.getInstance();
    const cacheKey = CacheService.createKey(this.CACHE_NAMESPACE, userId, 'preferences');
    
    try {
      await cache.del(cacheKey);
      logger.debug('User cache invalidated', { userId });
    } catch (error) {
      logger.error('Error invalidating user cache', error, { userId });
    }
  }

  /**
   * Invalidate multiple user caches
   */
  static async invalidateUserCaches(userIds: string[]): Promise<void> {
    const cache = CacheService.getInstance();
    
    try {
      const deletePromises = userIds.map(userId => {
        const cacheKey = CacheService.createKey(this.CACHE_NAMESPACE, userId, 'preferences');
        return cache.del(cacheKey);
      });

      await Promise.all(deletePromises);
      logger.debug('Multiple user caches invalidated', { count: userIds.length });
    } catch (error) {
      logger.error('Error invalidating multiple user caches', error, { userIds });
    }
  }

  /**
   * Update user and invalidate cache
   */
  static async updateUserAndInvalidateCache(
    userId: string, 
    updateData: Partial<IUser>
  ): Promise<IUser | null> {
    try {
      // Update in database
      const updatedUser = await User.updateById<IUser>(userId, updateData);
      
      if (updatedUser) {
        // Invalidate cache
        await this.invalidateUserCache(userId);
        logger.debug('User updated and cache invalidated', { userId });
      }

      return updatedUser;
    } catch (error) {
      logger.error('Error updating user and invalidating cache', error, { userId });
      throw error;
    }
  }

  /**
   * Get user notification settings with caching
   */
  static async getUserNotificationSettings(userId: string): Promise<IUser['notification_settings'] | null> {
    const user = await this.getUserWithPreferences(userId);
    return user?.notification_settings || null;
  }

  /**
   * Check if user is pro subscriber (cached)
   */
  static async isProSubscriber(userId: string): Promise<boolean> {
    const user = await this.getUserWithPreferences(userId);
    return user?.subscription_tier === 'pro';
  }

  /**
   * Get user timezone (cached)
   */
  static async getUserTimezone(userId: string): Promise<string> {
    const user = await this.getUserWithPreferences(userId);
    return user?.timezone || 'UTC';
  }

  /**
   * Fetch users from database (helper method)
   */
  private static async fetchUsersFromDatabase(userIds: string[]): Promise<Map<string, IUser>> {
    const result = new Map<string, IUser>();
    
    try {
      // Note: This would ideally be a single query with WHERE id IN (...)
      // For now, we'll use Promise.all with individual queries
      const userPromises = userIds.map(async (userId) => {
        const user = await User.findByIdWithPermissions(userId);
        return { userId, user };
      });

      const userResults = await Promise.all(userPromises);
      
      userResults.forEach(({ userId, user }) => {
        if (user) {
          result.set(userId, user);
        }
      });

      return result;
    } catch (error) {
      logger.error('Error fetching users from database', error, { userIds });
      return result;
    }
  }

  /**
   * Warm up cache for frequently accessed users
   */
  static async warmUpCache(userIds: string[]): Promise<void> {
    try {
      await this.getUsersWithPreferences(userIds);
      logger.info('Cache warmed up for users', { count: userIds.length });
    } catch (error) {
      logger.error('Error warming up cache', error, { userIds });
    }
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats(): Promise<{
    namespace: string;
    ttl: number;
    // Add more stats as needed
  }> {
    return {
      namespace: this.CACHE_NAMESPACE,
      ttl: this.CACHE_TTL
    };
  }
}