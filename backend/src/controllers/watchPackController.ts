import { Request, Response } from 'express';
import { WatchPack } from '../models/WatchPack';
import { UserWatchPack } from '../models/UserWatchPack';
import { Watch } from '../models/Watch';
import { Product } from '../models/Product';
import { IWatchPack } from '../types/database';
import { logger } from '../utils/logger';
import { successResponse, errorResponse } from '../utils/responseHelpers';
import { validateUUID } from '../utils/validation';

// Helper function to validate user authentication
const validateAuth = (req: Request, res: Response): string | null => {
  const userId = req.user?.id;
  if (!userId) {
    errorResponse(res, 401, 'Unauthorized');
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
      successResponse(res, watchPacks, 'Watch packs retrieved successfully');
    } catch (error) {
      logger.error('Error getting watch packs:', error);
      errorResponse(res, 500, 'Failed to retrieve watch packs');
    }
  }

  // Get popular watch packs
  static async getPopularWatchPacks(req: Request, res: Response): Promise<void> {
    try {
      const { limit = 10 } = req.query;
      const watchPacks = await WatchPack.getPopularWatchPacks(parseInt(limit as string));
      successResponse(res, watchPacks, 'Popular watch packs retrieved successfully');
    } catch (error) {
      logger.error('Error getting popular watch packs:', error);
      errorResponse(res, 500, 'Failed to retrieve popular watch packs');
    }
  }

  // Get specific watch pack by ID or slug
  static async getWatchPack(req: Request, res: Response): Promise<void> {
    try {
      const { packId } = req.params;
      
      if (!packId) {
        errorResponse(res, 400, 'Pack ID is required');
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
        errorResponse(res, 404, 'Watch pack not found');
        return;
      }

      if (!watchPack.is_active) {
        errorResponse(res, 404, 'Watch pack not found');
        return;
      }

      successResponse(res, watchPack, 'Watch pack retrieved successfully');
    } catch (error) {
      logger.error('Error getting watch pack:', error);
      errorResponse(res, 500, 'Failed to retrieve watch pack');
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
        errorResponse(res, 400, 'Name, slug, and product_ids array are required');
        return;
      }

      if (product_ids.length === 0) {
        errorResponse(res, 400, 'At least one product ID is required');
        return;
      }

      // Validate all product IDs exist
      for (const productId of product_ids) {
        if (!validateUUID(productId)) {
          errorResponse(res, 400, `Invalid product ID format: ${productId}`);
          return;
        }

        const product = await Product.findById<any>(productId);
        if (!product) {
          errorResponse(res, 404, `Product not found: ${productId}`);
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
      successResponse(res, watchPack, 'Watch pack created successfully', 201);
    } catch (error) {
      logger.error('Error creating watch pack:', error);
      if (error instanceof Error && error.message.includes('Validation failed')) {
        errorResponse(res, 400, error.message);
      } else if (error instanceof Error && error.message.includes('already exists')) {
        errorResponse(res, 409, error.message);
      } else {
        errorResponse(res, 500, 'Failed to create watch pack');
      }
    }
  }

  // Update watch pack (admin only)
  static async updateWatchPack(req: Request, res: Response): Promise<void> {
    try {
      const { packId } = req.params;

      if (!packId || !validateUUID(packId)) {
        errorResponse(res, 400, 'Invalid watch pack ID format');
        return;
      }

      const existingPack = await WatchPack.findById<IWatchPack>(packId);
      if (!existingPack) {
        errorResponse(res, 404, 'Watch pack not found');
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
          errorResponse(res, 400, 'Product IDs must be an array');
          return;
        }

        // Validate all product IDs exist
        for (const productId of product_ids) {
          if (!validateUUID(productId)) {
            errorResponse(res, 400, `Invalid product ID format: ${productId}`);
            return;
          }

          const product = await Product.findById<any>(productId);
          if (!product) {
            errorResponse(res, 404, `Product not found: ${productId}`);
            return;
          }
        }

        updateData.product_ids = product_ids;
      }

      const updatedPack = await WatchPack.updateById<IWatchPack>(packId, updateData);
      if (!updatedPack) {
        errorResponse(res, 500, 'Failed to update watch pack');
        return;
      }

      successResponse(res, updatedPack, 'Watch pack updated successfully');
    } catch (error) {
      logger.error('Error updating watch pack:', error);
      if (error instanceof Error && error.message.includes('Validation failed')) {
        errorResponse(res, 400, error.message);
      } else {
        errorResponse(res, 500, 'Failed to update watch pack');
      }
    }
  }

  // Delete watch pack (admin only)
  static async deleteWatchPack(req: Request, res: Response): Promise<void> {
    try {
      const { packId } = req.params;

      if (!packId || !validateUUID(packId)) {
        errorResponse(res, 400, 'Invalid watch pack ID format');
        return;
      }

      const watchPack = await WatchPack.findById<IWatchPack>(packId);
      if (!watchPack) {
        errorResponse(res, 404, 'Watch pack not found');
        return;
      }

      const deleted = await WatchPack.deleteById(packId);
      if (!deleted) {
        errorResponse(res, 500, 'Failed to delete watch pack');
        return;
      }

      successResponse(res, null, 'Watch pack deleted successfully');
    } catch (error) {
      logger.error('Error deleting watch pack:', error);
      errorResponse(res, 500, 'Failed to delete watch pack');
    }
  }

  // Subscribe user to watch pack
  static async subscribeToWatchPack(req: Request, res: Response): Promise<void> {
    try {
      const userId = validateAuth(req, res);
      if (!userId) return;

      const { packId } = req.params;
      if (!packId || !validateUUID(packId)) {
        errorResponse(res, 400, 'Invalid watch pack ID format');
        return;
      }

      // Check if watch pack exists and is active
      const watchPack = await WatchPack.findById<IWatchPack>(packId);
      if (!watchPack || !watchPack.is_active) {
        errorResponse(res, 404, 'Watch pack not found');
        return;
      }

      // Check if user is already subscribed
      const existingSubscription = await UserWatchPack.findUserSubscription(userId, packId);
      if (existingSubscription) {
        if (existingSubscription.is_active) {
          errorResponse(res, 409, 'Already subscribed to this watch pack');
          return;
        } else {
          // Reactivate existing subscription
          const reactivated = await UserWatchPack.toggleSubscription(userId, packId);
          if (!reactivated) {
            errorResponse(res, 500, 'Failed to reactivate subscription');
            return;
          }
          successResponse(res, null, 'Subscription reactivated successfully');
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
        await Watch.bulkCreate(filteredWatches);
      }

      successResponse(res, subscription, 'Successfully subscribed to watch pack', 201);
    } catch (error) {
      logger.error('Error subscribing to watch pack:', error);
      if (error instanceof Error && error.message.includes('already subscribed')) {
        errorResponse(res, 409, error.message);
      } else {
        errorResponse(res, 500, 'Failed to subscribe to watch pack');
      }
    }
  }

  // Unsubscribe user from watch pack
  static async unsubscribeFromWatchPack(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { packId } = req.params;

      if (!userId) {
        errorResponse(res, 401, 'Unauthorized');
        return;
      }

      if (!packId || !validateUUID(packId)) {
        errorResponse(res, 400, 'Invalid watch pack ID format');
        return;
      }

      const subscription = await UserWatchPack.findUserSubscription(userId, packId);
      if (!subscription) {
        errorResponse(res, 404, 'Subscription not found');
        return;
      }

      const unsubscribed = await UserWatchPack.unsubscribe(userId, packId);
      if (!unsubscribed) {
        errorResponse(res, 500, 'Failed to unsubscribe from watch pack');
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

      successResponse(res, null, 'Successfully unsubscribed from watch pack');
    } catch (error) {
      logger.error('Error unsubscribing from watch pack:', error);
      errorResponse(res, 500, 'Failed to unsubscribe from watch pack');
    }
  }

  // Get user's watch pack subscriptions
  static async getUserSubscriptions(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        errorResponse(res, 401, 'Unauthorized');
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
      successResponse(res, subscriptions, 'User subscriptions retrieved successfully');
    } catch (error) {
      logger.error('Error getting user subscriptions:', error);
      errorResponse(res, 500, 'Failed to retrieve user subscriptions');
    }
  }

  // Get user's subscriptions with watch pack details
  static async getUserSubscriptionsWithPacks(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        errorResponse(res, 401, 'Unauthorized');
        return;
      }

      const subscriptions = await UserWatchPack.getUserSubscriptionsWithPacks(userId);
      successResponse(res, subscriptions, 'User subscriptions with packs retrieved successfully');
    } catch (error) {
      logger.error('Error getting user subscriptions with packs:', error);
      errorResponse(res, 500, 'Failed to retrieve user subscriptions with packs');
    }
  }

  // Update subscription customizations
  static async updateSubscriptionCustomizations(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { packId } = req.params;

      if (!userId) {
        errorResponse(res, 401, 'Unauthorized');
        return;
      }

      if (!packId || !validateUUID(packId)) {
        errorResponse(res, 400, 'Invalid watch pack ID format');
        return;
      }

      const subscription = await UserWatchPack.findUserSubscription(userId, packId);
      if (!subscription) {
        errorResponse(res, 404, 'Subscription not found');
        return;
      }

      const { customizations } = req.body;
      if (!customizations || typeof customizations !== 'object') {
        errorResponse(res, 400, 'Customizations object is required');
        return;
      }

      const updated = await UserWatchPack.updateCustomizations(userId, packId, customizations);
      if (!updated) {
        errorResponse(res, 500, 'Failed to update subscription customizations');
        return;
      }

      const updatedSubscription = await UserWatchPack.findUserSubscription(userId, packId);
      successResponse(res, updatedSubscription, 'Subscription customizations updated successfully');
    } catch (error) {
      logger.error('Error updating subscription customizations:', error);
      errorResponse(res, 500, 'Failed to update subscription customizations');
    }
  }

  // Get watch pack statistics
  static async getWatchPackStats(req: Request, res: Response): Promise<void> {
    try {
      const { packId } = req.params;

      if (!packId || !validateUUID(packId)) {
        errorResponse(res, 400, 'Invalid watch pack ID format');
        return;
      }

      const stats = await WatchPack.getWatchPackStats(packId);
      if (!stats) {
        errorResponse(res, 404, 'Watch pack not found');
        return;
      }

      successResponse(res, stats, 'Watch pack statistics retrieved successfully');
    } catch (error) {
      logger.error('Error getting watch pack stats:', error);
      errorResponse(res, 500, 'Failed to retrieve watch pack statistics');
    }
  }

  // Get user's subscription statistics
  static async getUserSubscriptionStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        errorResponse(res, 401, 'Unauthorized');
        return;
      }

      const stats = await UserWatchPack.getUserSubscriptionStats(userId);
      successResponse(res, stats, 'User subscription statistics retrieved successfully');
    } catch (error) {
      logger.error('Error getting user subscription stats:', error);
      errorResponse(res, 500, 'Failed to retrieve user subscription statistics');
    }
  }

  // Find watch packs containing a specific product
  static async findPacksContainingProduct(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;

      if (!productId || !validateUUID(productId)) {
        errorResponse(res, 400, 'Invalid product ID format');
        return;
      }

      const watchPacks = await WatchPack.findPacksContainingProduct(productId);
      successResponse(res, watchPacks, 'Watch packs containing product retrieved successfully');
    } catch (error) {
      logger.error('Error finding packs containing product:', error);
      errorResponse(res, 500, 'Failed to find watch packs containing product');
    }
  }
}