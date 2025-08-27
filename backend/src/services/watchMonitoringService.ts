import { Watch } from '../models/Watch';
import { WatchPack } from '../models/WatchPack';
import { UserWatchPack } from '../models/UserWatchPack';
import { Product } from '../models/Product';
import { IWatch, IWatchPack, IProduct } from '../types/database';
import { logger } from '../utils/logger';

export interface WatchHealthStatus {
  watchId: string;
  productId: string;
  userId: string;
  isHealthy: boolean;
  lastChecked?: Date;
  lastAlerted?: Date | undefined;
  alertCount: number;
  issues: string[];
}

export interface WatchPackHealthStatus {
  packId: string;
  name: string;
  isHealthy: boolean;
  productCount: number;
  activeProductCount: number;
  subscriberCount: number;
  issues: string[];
}

export interface SystemWatchHealth {
  totalWatches: number;
  activeWatches: number;
  healthyWatches: number;
  watchesWithIssues: number;
  totalWatchPacks: number;
  activeWatchPacks: number;
  healthyWatchPacks: number;
  lastHealthCheck: Date;
}

export class WatchMonitoringService {
  /**
   * Check the health status of a specific watch
   */
  static async checkWatchHealth(watchId: string): Promise<WatchHealthStatus | null> {
    try {
      const watch = await Watch.findById<IWatch>(watchId);
      if (!watch) {
        return null;
      }

      const issues: string[] = [];
      let isHealthy = true;

      // Check if product still exists and is active
      const product = await Product.findById<IProduct>(watch.product_id);
      if (!product) {
        issues.push('Associated product no longer exists');
        isHealthy = false;
      } else if (!product.is_active) {
        issues.push('Associated product is inactive');
        isHealthy = false;
      }

      // Check if watch has valid retailer IDs
      if (watch.retailer_ids.length === 0) {
        issues.push('No retailers configured for monitoring');
        isHealthy = false;
      }

      // Check if watch has been inactive for too long
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      if (watch.last_alerted && watch.last_alerted < thirtyDaysAgo && watch.alert_count === 0) {
        issues.push('No alerts generated in the last 30 days');
      }

      // Check for configuration issues
      if (watch.availability_type === 'in_store' && !watch.zip_code) {
        issues.push('In-store monitoring requires ZIP code');
        isHealthy = false;
      }

      if (watch.zip_code && !watch.radius_miles) {
        issues.push('Location-based monitoring requires radius setting');
      }

      return {
        watchId: watch.id,
        productId: watch.product_id,
        userId: watch.user_id,
        isHealthy,
        lastChecked: new Date(),
        lastAlerted: watch.last_alerted || undefined,
        alertCount: watch.alert_count,
        issues
      };
    } catch (error) {
      logger.error(`Error checking watch health for ${watchId}:`, error);
      return null;
    }
  }

  /**
   * Check the health status of all watches for a user
   */
  static async checkUserWatchesHealth(userId: string): Promise<WatchHealthStatus[]> {
    try {
      const watches = await Watch.findByUserId(userId, { page: 1, limit: 1000 });
      const healthStatuses: WatchHealthStatus[] = [];

      for (const watch of watches.data) {
        const health = await this.checkWatchHealth(watch.id);
        if (health) {
          healthStatuses.push(health);
        }
      }

      return healthStatuses;
    } catch (error) {
      logger.error(`Error checking user watches health for ${userId}:`, error);
      return [];
    }
  }

  /**
   * Check the health status of a watch pack
   */
  static async checkWatchPackHealth(packId: string): Promise<WatchPackHealthStatus | null> {
    try {
      const pack = await WatchPack.findById<IWatchPack>(packId);
      if (!pack) {
        return null;
      }

      const issues: string[] = [];
      let isHealthy = true;
      let activeProductCount = 0;

      // Check if all products in the pack still exist and are active
      for (const productId of pack.product_ids) {
        const product = await Product.findById<IProduct>(productId);
        if (!product) {
          issues.push(`Product ${productId} no longer exists`);
          isHealthy = false;
        } else if (!product.is_active) {
          issues.push(`Product ${productId} is inactive`);
        } else {
          activeProductCount++;
        }
      }

      // Check if pack has any products
      if (pack.product_ids.length === 0) {
        issues.push('Watch pack contains no products');
        isHealthy = false;
      }

      // Check if pack has lost too many products
      const activePercentage = activeProductCount / pack.product_ids.length;
      if (activePercentage < 0.5) {
        issues.push('More than 50% of products are inactive');
        isHealthy = false;
      }

      // Check subscriber count consistency
      const actualSubscribers = await UserWatchPack.getActiveSubscribers(packId);
      if (actualSubscribers.length !== pack.subscriber_count) {
        issues.push('Subscriber count mismatch detected');
      }

      return {
        packId: pack.id,
        name: pack.name,
        isHealthy,
        productCount: pack.product_ids.length,
        activeProductCount,
        subscriberCount: pack.subscriber_count,
        issues
      };
    } catch (error) {
      logger.error(`Error checking watch pack health for ${packId}:`, error);
      return null;
    }
  }

  /**
   * Get system-wide watch health overview
   */
  static async getSystemWatchHealth(): Promise<SystemWatchHealth> {
    try {
      const watchStats = await Watch.getSystemWatchStats();
      const packStats = await WatchPack.getSystemWatchPackStats();

      // Sample a subset of watches to check health (for performance)
      const sampleWatches = await Watch.findBy<IWatch>({ is_active: true });

      let healthyWatches = 0;
      for (const watch of sampleWatches) {
        const health = await this.checkWatchHealth(watch.id);
        if (health?.isHealthy) {
          healthyWatches++;
        }
      }

      // Estimate healthy watches based on sample
      const healthyWatchesEstimate = sampleWatches.length > 0 
        ? Math.round((healthyWatches / sampleWatches.length) * watchStats.activeWatches)
        : watchStats.activeWatches;

      return {
        totalWatches: watchStats.totalWatches,
        activeWatches: watchStats.activeWatches,
        healthyWatches: healthyWatchesEstimate,
        watchesWithIssues: watchStats.activeWatches - healthyWatchesEstimate,
        totalWatchPacks: packStats.totalPacks,
        activeWatchPacks: packStats.activePacks,
        healthyWatchPacks: packStats.activePacks, // Simplified for now
        lastHealthCheck: new Date()
      };
    } catch (error) {
      logger.error('Error getting system watch health:', error);
      return {
        totalWatches: 0,
        activeWatches: 0,
        healthyWatches: 0,
        watchesWithIssues: 0,
        totalWatchPacks: 0,
        activeWatchPacks: 0,
        healthyWatchPacks: 0,
        lastHealthCheck: new Date()
      };
    }
  }

  /**
   * Cleanup inactive or problematic watches
   */
  static async cleanupWatches(): Promise<{
    inactiveProductWatches: number;
    inactiveSubscriptions: number;
    orphanedWatches: number;
  }> {
    try {
      logger.info('Starting watch cleanup process');

      // Clean up watches for inactive products
      const inactiveProductWatches = await Watch.cleanupInactiveProductWatches();
      logger.info(`Cleaned up ${inactiveProductWatches} watches for inactive products`);

      // Clean up inactive subscriptions
      const inactiveSubscriptions = await UserWatchPack.cleanupInactiveSubscriptions();
      logger.info(`Cleaned up ${inactiveSubscriptions} inactive subscriptions`);

      // Find and clean up orphaned watches (watches without valid users)
      // Note: This would need to be implemented with proper database access
      const orphanedWatches = 0; // Placeholder - would implement with proper DB access
      logger.info(`Cleaned up ${orphanedWatches} orphaned watches`);

      return {
        inactiveProductWatches,
        inactiveSubscriptions,
        orphanedWatches
      };
    } catch (error) {
      logger.error('Error during watch cleanup:', error);
      throw error;
    }
  }

  /**
   * Update watch pack subscriber counts
   */
  static async updateWatchPackSubscriberCounts(): Promise<number> {
    try {
      const packs = await WatchPack.findBy<IWatchPack>({ is_active: true });
      let updatedCount = 0;

      for (const pack of packs) {
        const actualSubscribers = await UserWatchPack.getActiveSubscribers(pack.id);
        if (actualSubscribers.length !== pack.subscriber_count) {
          await WatchPack.updateById<IWatchPack>(pack.id, {
            subscriber_count: actualSubscribers.length
          });
          updatedCount++;
        }
      }

      logger.info(`Updated subscriber counts for ${updatedCount} watch packs`);
      return updatedCount;
    } catch (error) {
      logger.error('Error updating watch pack subscriber counts:', error);
      throw error;
    }
  }

  /**
   * Get watches that need monitoring (for external monitoring systems)
   */
  static async getWatchesForMonitoring(
    retailerId?: string,
    limit: number = 100
  ): Promise<Array<IWatch & { product: IProduct }>> {
    try {
      const watches = await Watch.getWatchesForMonitoring(retailerId, limit);
      const watchesWithProducts = [];

      for (const watch of watches) {
        const product = await Product.findById<IProduct>(watch.product_id);
        if (product && product.is_active) {
          watchesWithProducts.push({
            ...watch,
            product
          });
        }
      }

      return watchesWithProducts;
    } catch (error) {
      logger.error('Error getting watches for monitoring:', error);
      return [];
    }
  }

  /**
   * Update watch alert information after an alert is sent
   */
  static async recordWatchAlert(watchId: string, alertedAt: Date = new Date()): Promise<boolean> {
    try {
      return await Watch.updateAlertInfo(watchId, alertedAt);
    } catch (error) {
      logger.error(`Error recording watch alert for ${watchId}:`, error);
      return false;
    }
  }

  /**
   * Get watch performance metrics
   */
  static async getWatchPerformanceMetrics(userId?: string): Promise<{
    avgAlertsPerWatch: number;
    avgTimeBetweenAlerts: number;
    mostActiveWatches: Array<{ watchId: string; productId: string; alertCount: number }>;
    leastActiveWatches: Array<{ watchId: string; productId: string; alertCount: number }>;
  }> {
    try {
      const filters: any = { is_active: true };
      if (userId) {
        filters.user_id = userId;
      }

      const watches = await Watch.findBy<IWatch>(filters);

      if (watches.length === 0) {
        return {
          avgAlertsPerWatch: 0,
          avgTimeBetweenAlerts: 0,
          mostActiveWatches: [],
          leastActiveWatches: []
        };
      }

      // Calculate average alerts per watch
      const totalAlerts = watches.reduce((sum, watch) => sum + watch.alert_count, 0);
      const avgAlertsPerWatch = totalAlerts / watches.length;

      // Calculate average time between alerts (simplified)
      const watchesWithAlerts = watches.filter(w => w.last_alerted && w.alert_count > 0);
      let avgTimeBetweenAlerts = 0;
      
      if (watchesWithAlerts.length > 0) {
        const totalTime = watchesWithAlerts.reduce((sum, watch) => {
          const timeSinceCreated = new Date().getTime() - new Date(watch.created_at).getTime();
          return sum + (timeSinceCreated / watch.alert_count);
        }, 0);
        avgTimeBetweenAlerts = totalTime / watchesWithAlerts.length;
      }

      // Get most and least active watches
      const sortedByAlerts = watches.sort((a, b) => b.alert_count - a.alert_count);
      const mostActiveWatches = sortedByAlerts.slice(0, 5).map(w => ({
        watchId: w.id,
        productId: w.product_id,
        alertCount: w.alert_count
      }));
      const leastActiveWatches = sortedByAlerts.slice(-5).reverse().map(w => ({
        watchId: w.id,
        productId: w.product_id,
        alertCount: w.alert_count
      }));

      return {
        avgAlertsPerWatch: Math.round(avgAlertsPerWatch * 100) / 100,
        avgTimeBetweenAlerts: Math.round(avgTimeBetweenAlerts / (1000 * 60 * 60)), // Convert to hours
        mostActiveWatches,
        leastActiveWatches
      };
    } catch (error) {
      logger.error('Error getting watch performance metrics:', error);
      return {
        avgAlertsPerWatch: 0,
        avgTimeBetweenAlerts: 0,
        mostActiveWatches: [],
        leastActiveWatches: []
      };
    }
  }
}