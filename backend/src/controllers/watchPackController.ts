import { Request, Response } from 'express';
import { WatchPack } from '../models/WatchPack';
import { UserWatchPack } from '../models/UserWatchPack';
import { Watch } from '../models/Watch';
import { Product } from '../models/Product';
import { IWatchPack } from '../types/database';
import { logger } from '../utils/logger';
import { ResponseHelper } from '../utils/responseHelpers';
import { validateUUID } from '../utils/validation';

// Helper function to validate user authentication
const validateAuth = (req: Request, res: Response): string | null => {
  const userId = req.user?.id;
  if (!userId) {
    ResponseHelper.error(res, 'UNAUTHORIZED', 'Unauthorized', 401);
    return null;
  }
  return userId;
};

export class WatchPackController {
  // Get all active watch packs
  static async getWatchPacks(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 20,
        search
      } = req.query;

      const options = {
        page: parseInt(page as string, 10),
        limit: Math.min(parseInt(limit as string, 10), 100), // Cap at 100
        search: search as string
      };

      const watchPacks = await WatchPack.getActiveWatchPacks(options);
      ResponseHelper.successWithPagination(res, watchPacks.data, {
        page: watchPacks.page,
        limit: watchPacks.limit,
        total: watchPacks.total
      });
    } catch (error) {
      logger.error('Error getting watch packs:', error);
      ResponseHelper.internalError(res, 'Failed to retrieve watch packs');
    }
  }

  // Get popular watch packs
  static async getPopularWatchPacks(req: Request, res: Response): Promise<void> {
    try {
      const { limit = 10 } = req.query;
      const watchPacks = await WatchPack.getPopularWatchPacks(parseInt(limit as string));
      ResponseHelper.success(res, watchPacks);
    } catch (error) {
      logger.error('Error getting popular watch packs:', error);
      ResponseHelper.internalError(res, 'Failed to retrieve popular watch packs');
    }
  }

  // Get specific watch pack by ID or slug
  static async getWatchPack(req: Request, res: Response): Promise<void> {
    try {
      const { packId } = req.params;
      
      if (!packId) {
        ResponseHelper.badRequest(res, 'Pack ID is required');
        return;
      }

      let watchPack: IWatchPack | null = null;

      // Try to find by UUID first, then by slug
      if (validateUUID(packId)) {
        watchPack = await WatchPack.findById<IWatchPack>(packId);
      } else {
        watchPack = await WatchPack.findBySlug(packId);
      }

      if (!watchPack) {
        ResponseHelper.notFound(res, 'Watch pack not found');
        return;
      }

      if (!watchPack.is_active) {
        ResponseHelper.notFound(res, 'Watch pack not found');
        return;
      }

      ResponseHelper.success(res, watchPack);
    } catch (error) {
      logger.error('Error getting watch pack:', error);
      ResponseHelper.internalError(res, 'Failed to retrieve watch pack');
    }
  }

  // Create a new watch pack (admin only)
  static async createWatchPack(req: Request, res: Response): Promise<void> {
    try {
      // This would typically require admin authentication
      const {
        name,
        slug,
        description,
        product_ids,
        auto_update = true,
        update_criteria
      } = req.body;

      // Validate required fields
      if (!name || !slug || !product_ids || !Array.isArray(product_ids)) {
        ResponseHelper.badRequest(res, 'Name, slug, and product_ids array are required');
        return;
      }

      if (product_ids.length === 0) {
        ResponseHelper.badRequest(res, 'At least one product ID is required');
        return;
      }

      // Validate all product IDs exist
      for (const productId of product_ids) {
        if (!validateUUID(productId)) {
          ResponseHelper.badRequest(res, `Invalid product ID format: ${productId}`);
          return;
        }

        const product = await Product.findById<any>(productId);
        if (!product) {
          ResponseHelper.notFound(res, `Product not found: ${productId}`);
          return;
        }
      }

      const packData: Partial<IWatchPack> = {
        name,
        slug,
        description,
        product_ids,
        auto_update,
        update_criteria,
        is_active: true
      };

      const watchPack = await WatchPack.createWatchPack(packData);
      ResponseHelper.success(res, watchPack, 201);
    } catch (error) {
      logger.error('Error creating watch pack:', error);
      if (error instanceof Error && error.message.includes('Validation failed')) {
        ResponseHelper.badRequest(res, error.message);
      } else if (error instanceof Error && error.message.includes('already exists')) {
        ResponseHelper.error(res, 'CONFLICT', error.message);
      } else {
        ResponseHelper.internalError(res, 'Failed to create watch pack');
      }
    }
  }

  // Update watch pack (admin only)
  static async updateWatchPack(req: Request, res: Response): Promise<void> {
    try {
      const { packId } = req.params;

      if (!packId || !validateUUID(packId)) {
        ResponseHelper.badRequest(res, 'Invalid watch pack ID format');
        return;
      }

      const existingPack = await WatchPack.findById<IWatchPack>(packId);
      if (!existingPack) {
        ResponseHelper.notFound(res, 'Watch pack not found');
        return;
      }

      const {
        name,
        description,
        product_ids,
        auto_update,
        update_criteria,
        is_active
      } = req.body;

      const updateData: Partial<IWatchPack> = {};

      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (auto_update !== undefined) updateData.auto_update = Boolean(auto_update);
      if (update_criteria !== undefined) updateData.update_criteria = update_criteria;
      if (is_active !== undefined) updateData.is_active = Boolean(is_active);

      if (product_ids !== undefined) {
        if (!Array.isArray(product_ids)) {
          ResponseHelper.badRequest(res, 'Product IDs must be an array');
          return;
        }

        // Validate all product IDs exist
        for (const productId of product_ids) {
          if (!validateUUID(productId)) {
            ResponseHelper.badRequest(res, `Invalid product ID format: ${productId}`);
            return;
          }

          const product = await Product.findById<any>(productId);
          if (!product) {
            ResponseHelper.notFound(res, `Product not found: ${productId}`);
            return;
          }
        }

        updateData.product_ids = product_ids;
      }

      const updatedPack = await WatchPack.updateById<IWatchPack>(packId, updateData);
      if (!updatedPack) {
        ResponseHelper.internalError(res, 'Failed to update watch pack');
        return;
      }

      ResponseHelper.success(res, updatedPack);
    } catch (error) {
      logger.error('Error updating watch pack:', error);
      if (error instanceof Error && error.message.includes('Validation failed')) {
        ResponseHelper.badRequest(res, error.message);
      } else {
        ResponseHelper.internalError(res, 'Failed to update watch pack');
      }
    }
  }

  // Delete watch pack (admin only)
  static async deleteWatchPack(req: Request, res: Response): Promise<void> {
    try {
      const { packId } = req.params;

      if (!packId || !validateUUID(packId)) {
        ResponseHelper.badRequest(res, 'Invalid watch pack ID format');
        return;
      }

      const watchPack = await WatchPack.findById<IWatchPack>(packId);
      if (!watchPack) {
        ResponseHelper.notFound(res, 'Watch pack not found');
        return;
      }

      const deleted = await WatchPack.deleteById(packId);
      if (!deleted) {
        ResponseHelper.internalError(res, 'Failed to delete watch pack');
        return;
      }

      ResponseHelper.success(res, null);
    } catch (error) {
      logger.error('Error deleting watch pack:', error);
      ResponseHelper.internalError(res, 'Failed to delete watch pack');
    }
  }

  // Subscribe user to watch pack
  static async subscribeToWatchPack(req: Request, res: Response): Promise<void> {
    try {
      const userId = validateAuth(req, res);
      if (!userId) return;

      const { packId } = req.params;
      if (!packId || !validateUUID(packId)) {
        ResponseHelper.badRequest(res, 'Invalid watch pack ID format');
        return;
      }

      // Check if watch pack exists and is active
      const watchPack = await WatchPack.findById<IWatchPack>(packId);
      if (!watchPack || !watchPack.is_active) {
        ResponseHelper.notFound(res, 'Watch pack not found');
        return;
      }

      // Check if user is already subscribed
      const existingSubscription = await UserWatchPack.findUserSubscription(userId, packId);
      if (existingSubscription) {
        if (existingSubscription.is_active) {
          ResponseHelper.error(res, 'CONFLICT', 'Already subscribed to this watch pack');
          return;
        } else {
          // Reactivate existing subscription
          const reactivated = await UserWatchPack.toggleSubscription(userId, packId);
          if (!reactivated) {
            ResponseHelper.internalError(res, 'Failed to reactivate subscription');
            return;
          }
          ResponseHelper.success(res, null);
          return;
        }
      }

      const { customizations = {} } = req.body;

      // Create subscription
      const subscription = await UserWatchPack.subscribe(userId, packId, customizations);

      // Update subscriber count
      await WatchPack.updateSubscriberCount(packId, 1);

      // Create individual watches for all products in the pack
      const watchesToCreate = watchPack.product_ids.map(productId => ({
        user_id: userId,
        product_id: productId,
        retailer_ids: [], // User can customize later
        availability_type: 'both' as const,
        is_active: true,
        alert_preferences: customizations.alert_preferences || {}
      }));

      // Filter out products user already watches
      const filteredWatches = [];
      for (const watchData of watchesToCreate) {
        const existingWatch = await Watch.findUserProductWatch(userId, watchData.product_id);
        if (!existingWatch) {
          filteredWatches.push(watchData);
        }
      }

      if (filteredWatches.length > 0) {
        // Enforce watch limit for bulk creation
        const { SubscriptionService } = await import('../services/subscriptionService');
        const quota = await SubscriptionService.checkQuota(userId, 'watch_created');
        if (quota.limit !== undefined && quota.limit !== null) {
          const used = quota.used || 0;
          const projected = used + filteredWatches.length;
          if (projected > quota.limit) {
            ResponseHelper.error(
              res,
              'WATCH_LIMIT_REACHED',
              `Subscribing would exceed your watch limit (${quota.limit}). Remove some watches or upgrade your plan.`,
              403
            );
            return;
          }
        }
        await Watch.bulkCreate(filteredWatches);
      }

      ResponseHelper.success(res, subscription, 201);
    } catch (error) {
      logger.error('Error subscribing to watch pack:', error);
      if (error instanceof Error && error.message.includes('already subscribed')) {
        ResponseHelper.error(res, 'CONFLICT', error.message);
      } else {
        ResponseHelper.internalError(res, 'Failed to subscribe to watch pack');
      }
    }
  }

  // Unsubscribe user from watch pack
  static async unsubscribeFromWatchPack(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { packId } = req.params;

      if (!userId) {
        ResponseHelper.error(res, 'UNAUTHORIZED', 'Unauthorized', 401);
        return;
      }

      if (!packId || !validateUUID(packId)) {
        ResponseHelper.badRequest(res, 'Invalid watch pack ID format');
        return;
      }

      const subscription = await UserWatchPack.findUserSubscription(userId, packId);
      if (!subscription) {
        ResponseHelper.notFound(res, 'Subscription not found');
        return;
      }

      const unsubscribed = await UserWatchPack.unsubscribe(userId, packId);
      if (!unsubscribed) {
        ResponseHelper.internalError(res, 'Failed to unsubscribe from watch pack');
        return;
      }

      // Update subscriber count
      await WatchPack.updateSubscriberCount(packId, -1);

      // Optionally remove individual watches (based on user preference)
      const { remove_watches = false } = req.body;
      if (remove_watches) {
        const watchPack = await WatchPack.findById<IWatchPack>(packId);
        if (watchPack) {
          for (const productId of watchPack.product_ids) {
            const watch = await Watch.findUserProductWatch(userId, productId);
            if (watch) {
              await Watch.deleteById(watch.id);
            }
          }
        }
      }

      ResponseHelper.success(res, null);
    } catch (error) {
      logger.error('Error unsubscribing from watch pack:', error);
      ResponseHelper.internalError(res, 'Failed to unsubscribe from watch pack');
    }
  }

  // Get user's watch pack subscriptions
  static async getUserSubscriptions(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        ResponseHelper.error(res, 'UNAUTHORIZED', 'Unauthorized', 401);
        return;
      }

      const {
        page = 1,
        limit = 20,
        is_active
      } = req.query;

      const options: any = {
        page: parseInt(page as string),
        limit: Math.min(parseInt(limit as string), 100),
      };

      if (is_active !== undefined) {
        options.is_active = is_active === 'true';
      }

      const subscriptions = await UserWatchPack.findByUserId(userId, options);
      ResponseHelper.successWithPagination(res, subscriptions.data, {
        page: subscriptions.page,
        limit: subscriptions.limit,
        total: subscriptions.total
      });
    } catch (error) {
      logger.error('Error getting user subscriptions:', error);
      ResponseHelper.internalError(res, 'Failed to retrieve user subscriptions');
    }
  }

  // Get user's subscriptions with watch pack details
  static async getUserSubscriptionsWithPacks(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        ResponseHelper.error(res, 'UNAUTHORIZED', 'Unauthorized', 401);
        return;
      }

      const subscriptions = await UserWatchPack.getUserSubscriptionsWithPacks(userId);
      ResponseHelper.success(res, subscriptions);
    } catch (error) {
      logger.error('Error getting user subscriptions with packs:', error);
      ResponseHelper.internalError(res, 'Failed to retrieve user subscriptions with packs');
    }
  }

  // Update subscription customizations
  static async updateSubscriptionCustomizations(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { packId } = req.params;

      if (!userId) {
        ResponseHelper.error(res, 'UNAUTHORIZED', 'Unauthorized', 401);
        return;
      }

      if (!packId || !validateUUID(packId)) {
        ResponseHelper.badRequest(res, 'Invalid watch pack ID format');
        return;
      }

      const subscription = await UserWatchPack.findUserSubscription(userId, packId);
      if (!subscription) {
        ResponseHelper.notFound(res, 'Subscription not found');
        return;
      }

      const { customizations } = req.body;
      if (!customizations || typeof customizations !== 'object') {
        ResponseHelper.badRequest(res, 'Customizations object is required');
        return;
      }

      const updated = await UserWatchPack.updateCustomizations(userId, packId, customizations);
      if (!updated) {
        ResponseHelper.internalError(res, 'Failed to update subscription customizations');
        return;
      }

      const updatedSubscription = await UserWatchPack.findUserSubscription(userId, packId);
      ResponseHelper.success(res, updatedSubscription);
    } catch (error) {
      logger.error('Error updating subscription customizations:', error);
      ResponseHelper.internalError(res, 'Failed to update subscription customizations');
    }
  }

  // Get watch pack statistics
  static async getWatchPackStats(req: Request, res: Response): Promise<void> {
    try {
      const { packId } = req.params;

      if (!packId || !validateUUID(packId)) {
        ResponseHelper.badRequest(res, 'Invalid watch pack ID format');
        return;
      }

      const stats = await WatchPack.getWatchPackStats(packId);
      if (!stats) {
        ResponseHelper.notFound(res, 'Watch pack not found');
        return;
      }

      ResponseHelper.success(res, stats);
    } catch (error) {
      logger.error('Error getting watch pack stats:', error);
      ResponseHelper.internalError(res, 'Failed to retrieve watch pack statistics');
    }
  }

  // Get user's subscription statistics
  static async getUserSubscriptionStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        ResponseHelper.error(res, 'UNAUTHORIZED', 'Unauthorized', 401);
        return;
      }

      const stats = await UserWatchPack.getUserSubscriptionStats(userId);
      ResponseHelper.success(res, stats);
    } catch (error) {
      logger.error('Error getting user subscription stats:', error);
      ResponseHelper.internalError(res, 'Failed to retrieve user subscription statistics');
    }
  }

  // Find watch packs containing a specific product
  static async findPacksContainingProduct(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;

      if (!productId || !validateUUID(productId)) {
        ResponseHelper.badRequest(res, 'Invalid product ID format');
        return;
      }

      const watchPacks = await WatchPack.findPacksContainingProduct(productId);
      ResponseHelper.success(res, watchPacks);
    } catch (error) {
      logger.error('Error finding packs containing product:', error);
      ResponseHelper.internalError(res, 'Failed to find watch packs containing product');
    }
  }
}
