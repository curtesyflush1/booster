import { BaseModel } from './BaseModel';
import { IUserWatchPack, IValidationError, IPaginatedResult } from '../types/database';
import { handleDatabaseError } from '../config/database';
import { logger } from '../utils/logger';

export class UserWatchPack extends BaseModel<IUserWatchPack> {
  protected static override tableName = 'user_watch_packs';

  // Validation rules for user watch pack data
  validate(data: Partial<IUserWatchPack>): IValidationError[] {
    const errors: IValidationError[] = [];

    // User ID validation
    if (data.user_id !== undefined) {
      const userIdError = UserWatchPack.validateRequired(data.user_id, 'user_id');
      if (userIdError) errors.push(userIdError);
    }

    // Watch Pack ID validation
    if (data.watch_pack_id !== undefined) {
      const packIdError = UserWatchPack.validateRequired(data.watch_pack_id, 'watch_pack_id');
      if (packIdError) errors.push(packIdError);
    }

    // Customizations validation (should be an object)
    if (data.customizations !== undefined) {
      if (typeof data.customizations !== 'object' || data.customizations === null) {
        errors.push({
          field: 'customizations',
          message: 'Customizations must be an object',
          value: data.customizations
        });
      }
    }

    return errors;
  }

  // Sanitize user watch pack input
  sanitize(data: Partial<IUserWatchPack>): Partial<IUserWatchPack> {
    const sanitized: Partial<IUserWatchPack> = { ...data };

    // Ensure customizations is an object
    if (!sanitized.customizations || typeof sanitized.customizations !== 'object') {
      sanitized.customizations = {};
    }

    // Set default values
    if (sanitized.is_active === undefined) {
      sanitized.is_active = true;
    }

    return sanitized;
  }

  // Create user watch pack subscription with validation
  static async createSubscription(subscriptionData: Partial<IUserWatchPack>): Promise<IUserWatchPack> {
    const subscription = new UserWatchPack();
    const sanitizedData = subscription.sanitize(subscriptionData);

    // Validate the data
    const errors = subscription.validate(sanitizedData);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
    }

    // Check for existing subscription
    if (sanitizedData.user_id && sanitizedData.watch_pack_id) {
      const existing = await this.findOneBy<IUserWatchPack>({
        user_id: sanitizedData.user_id,
        watch_pack_id: sanitizedData.watch_pack_id
      });
      if (existing) {
        throw new Error('User is already subscribed to this watch pack');
      }
    }

    return this.create<IUserWatchPack>(sanitizedData);
  }

  // Find user's watch pack subscriptions
  static async findByUserId(
    userId: string,
    options: {
      is_active?: boolean;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<IPaginatedResult<IUserWatchPack>> {
    try {
      const { is_active = true, page = 1, limit = 20 } = options;

      let query = this.db(this.getTableName())
        .where('user_id', userId);

      if (is_active !== undefined) {
        query = query.where('is_active', is_active);
      }

      return this.getPaginatedResults<IUserWatchPack>(query, page, limit, 'created_at', 'desc');
    } catch (error) {
      logger.error(`Error finding user watch pack subscriptions:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Find subscriptions for a specific watch pack
  static async findByWatchPackId(
    watchPackId: string,
    options: {
      is_active?: boolean;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<IPaginatedResult<IUserWatchPack>> {
    try {
      const { is_active = true, page = 1, limit = 20 } = options;

      let query = this.db(this.getTableName())
        .where('watch_pack_id', watchPackId);

      if (is_active !== undefined) {
        query = query.where('is_active', is_active);
      }

      return this.getPaginatedResults<IUserWatchPack>(query, page, limit, 'created_at', 'desc');
    } catch (error) {
      logger.error(`Error finding watch pack subscriptions:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Find specific user subscription to a watch pack
  static async findUserSubscription(userId: string, watchPackId: string): Promise<IUserWatchPack | null> {
    return this.findOneBy<IUserWatchPack>({
      user_id: userId,
      watch_pack_id: watchPackId
    });
  }

  // Subscribe user to watch pack
  static async subscribe(
    userId: string,
    watchPackId: string,
    customizations: Record<string, any> = {}
  ): Promise<IUserWatchPack> {
    const subscriptionData: Partial<IUserWatchPack> = {
      user_id: userId,
      watch_pack_id: watchPackId,
      customizations,
      is_active: true
    };

    return this.createSubscription(subscriptionData);
  }

  // Unsubscribe user from watch pack
  static async unsubscribe(userId: string, watchPackId: string): Promise<boolean> {
    try {
      const subscription = await this.findUserSubscription(userId, watchPackId);
      if (!subscription) return false;

      const deleted = await this.deleteById(subscription.id);
      return deleted;
    } catch (error) {
      logger.error(`Error unsubscribing from watch pack:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Toggle subscription active status
  static async toggleSubscription(userId: string, watchPackId: string): Promise<boolean> {
    try {
      const subscription = await this.findUserSubscription(userId, watchPackId);
      if (!subscription) return false;

      const updated = await this.updateById<IUserWatchPack>(subscription.id, {
        is_active: !subscription.is_active
      });

      return updated !== null;
    } catch (error) {
      logger.error(`Error toggling subscription:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Update subscription customizations
  static async updateCustomizations(
    userId: string,
    watchPackId: string,
    customizations: Record<string, any>
  ): Promise<boolean> {
    try {
      const subscription = await this.findUserSubscription(userId, watchPackId);
      if (!subscription) return false;

      const updatedCustomizations = { ...subscription.customizations, ...customizations };
      const updated = await this.updateById<IUserWatchPack>(subscription.id, {
        customizations: updatedCustomizations
      });

      return updated !== null;
    } catch (error) {
      logger.error(`Error updating subscription customizations:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Get user's active watch pack subscriptions with pack details
  static async getUserSubscriptionsWithPacks(userId: string): Promise<Array<IUserWatchPack & {
    watch_pack: {
      id: string;
      name: string;
      slug: string;
      description?: string;
      product_ids: string[];
      subscriber_count: number;
    };
  }>> {
    try {
      return this.db(this.getTableName())
        .select(
          `${this.getTableName()}.*`,
          'watch_packs.id as pack_id',
          'watch_packs.name as pack_name',
          'watch_packs.slug as pack_slug',
          'watch_packs.description as pack_description',
          'watch_packs.product_ids as pack_product_ids',
          'watch_packs.subscriber_count as pack_subscriber_count'
        )
        .join('watch_packs', `${this.getTableName()}.watch_pack_id`, 'watch_packs.id')
        .where(`${this.getTableName()}.user_id`, userId)
        .where(`${this.getTableName()}.is_active`, true)
        .where('watch_packs.is_active', true)
        .orderBy(`${this.getTableName()}.created_at`, 'desc')
        .then(rows => rows.map(row => ({
          id: row.id,
          user_id: row.user_id,
          watch_pack_id: row.watch_pack_id,
          customizations: row.customizations,
          is_active: row.is_active,
          created_at: row.created_at,
          updated_at: row.updated_at,
          watch_pack: {
            id: row.pack_id,
            name: row.pack_name,
            slug: row.pack_slug,
            description: row.pack_description,
            product_ids: row.pack_product_ids,
            subscriber_count: row.pack_subscriber_count
          }
        })));
    } catch (error) {
      logger.error(`Error getting user subscriptions with packs:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Get subscription statistics for a user
  static async getUserSubscriptionStats(userId: string): Promise<{
    totalSubscriptions: number;
    activeSubscriptions: number;
    totalProducts: number;
    recentSubscriptions: number;
  }> {
    try {
      const totalResult = await this.db(this.getTableName())
        .where('user_id', userId)
        .count('* as count');

      const activeResult = await this.db(this.getTableName())
        .where('user_id', userId)
        .where('is_active', true)
        .count('* as count');

      // Get total products across all active subscriptions
      const productsResult = await this.db(this.getTableName())
        .select(this.db.raw('SUM(jsonb_array_length(watch_packs.product_ids)) as total_products'))
        .join('watch_packs', `${this.getTableName()}.watch_pack_id`, 'watch_packs.id')
        .where(`${this.getTableName()}.user_id`, userId)
        .where(`${this.getTableName()}.is_active`, true)
        .where('watch_packs.is_active', true);

      // Get recent subscriptions (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentResult = await this.db(this.getTableName())
        .where('user_id', userId)
        .where('created_at', '>=', sevenDaysAgo)
        .count('* as count');

      return {
        totalSubscriptions: Number(totalResult[0]?.count || 0),
        activeSubscriptions: Number(activeResult[0]?.count || 0),
        totalProducts: Number(productsResult[0]?.total_products || 0),
        recentSubscriptions: Number(recentResult[0]?.count || 0)
      };
    } catch (error) {
      logger.error(`Error getting user subscription statistics:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Get all active subscribers for a watch pack
  static async getActiveSubscribers(watchPackId: string): Promise<string[]> {
    try {
      const subscribers = await this.db(this.getTableName())
        .select('user_id')
        .where('watch_pack_id', watchPackId)
        .where('is_active', true);

      return subscribers.map(sub => sub.user_id);
    } catch (error) {
      logger.error(`Error getting active subscribers:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Bulk subscribe users to a watch pack
  static async bulkSubscribe(
    userIds: string[],
    watchPackId: string,
    customizations: Record<string, any> = {}
  ): Promise<IUserWatchPack[]> {
    try {
      const subscriptions = userIds.map(userId => ({
        user_id: userId,
        watch_pack_id: watchPackId,
        customizations,
        is_active: true
      }));

      const userWatchPack = new UserWatchPack();
      const sanitizedSubscriptions = subscriptions.map(sub => userWatchPack.sanitize(sub));

      // Validate all subscriptions
      for (const subData of sanitizedSubscriptions) {
        const errors = userWatchPack.validate(subData);
        if (errors.length > 0) {
          throw new Error(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
        }
      }

      return this.bulkCreate<IUserWatchPack>(sanitizedSubscriptions);
    } catch (error) {
      logger.error(`Error bulk subscribing users:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Clean up inactive subscriptions
  static async cleanupInactiveSubscriptions(): Promise<number> {
    try {
      // Remove subscriptions to inactive watch packs
      const count = await this.db(this.getTableName())
        .whereIn('watch_pack_id', function () {
          this.select('id')
            .from('watch_packs')
            .where('is_active', false);
        })
        .del();

      return count;
    } catch (error) {
      logger.error(`Error cleaning up inactive subscriptions:`, error);
      throw handleDatabaseError(error);
    }
  }
}