import { BaseModel } from '../models/BaseModel';
import { PriceComparisonService } from './priceComparisonService';
import { AlertProcessingService } from './alertProcessingService';
import { logger } from '../utils/logger';
import { handleDatabaseError } from '../config/database';

export interface PriceDropAlert {
  userId: string;
  productId: string;
  retailerId: string;
  watchId: string;
  currentPrice: number;
  previousPrice: number;
  savingsAmount: number;
  savingsPercentage: number;
  dealScore: number;
  alertType: 'price_drop' | 'best_deal' | 'historical_low';
}

export interface PriceDropThreshold {
  userId: string;
  productId: string;
  minSavingsPercentage: number;
  minSavingsAmount: number;
  maxPrice?: number;
  onlyBestDeals: boolean;
}

export class PriceDropAlertService extends BaseModel<any> {
  protected static override tableName = 'price_drop_thresholds';

  // Required abstract methods from BaseModel
  validate(data: any): any[] {
    return [];
  }

  sanitize(data: any): any {
    return data;
  }

  /**
   * Monitor price changes and generate alerts for users
   */
  static async monitorPriceChanges(): Promise<void> {
    try {
      logger.info('Starting price change monitoring');

      // Get all active watches with price monitoring enabled
      const activeWatches = await this.getActiveWatchesWithPriceMonitoring();

      if (activeWatches.length === 0) {
        logger.info('No active watches found for price monitoring');
        return;
      }

      logger.info(`Monitoring ${activeWatches.length} active watches for price changes`);

      // Process watches in batches to avoid overwhelming the system
      const batchSize = 50;
      for (let i = 0; i < activeWatches.length; i += batchSize) {
        const batch = activeWatches.slice(i, i + batchSize);
        await this.processPriceChangeBatch(batch);
      }

      logger.info('Price change monitoring completed');
    } catch (error) {
      logger.error('Error during price change monitoring:', error);
      throw handleDatabaseError(error);
    }
  }

  /**
   * Get active watches that have price monitoring enabled
   */
  private static async getActiveWatchesWithPriceMonitoring(): Promise<any[]> {
    return this.db('watches')
      .select(
        'watches.*',
        'users.id as user_id',
        'users.subscription_tier',
        'products.name as product_name'
      )
      .leftJoin('users', 'watches.user_id', 'users.id')
      .leftJoin('products', 'watches.product_id', 'products.id')
      .where('watches.is_active', true)
      .where('users.is_active', true)
      .whereNotNull('watches.max_price') // Only watches with price thresholds
      .orderBy('watches.updated_at', 'desc');
  }

  /**
   * Process a batch of watches for price changes
   */
  private static async processPriceChangeBatch(watches: any[]): Promise<void> {
    const promises = watches.map(watch => this.processWatchPriceChange(watch));
    await Promise.allSettled(promises);
  }

  /**
   * Process price changes for a single watch
   */
  private static async processWatchPriceChange(watch: any): Promise<void> {
    try {
      // Get current price comparison for the product
      const comparison = await PriceComparisonService.getProductPriceComparison(
        watch.product_id,
        true // Include historical context
      );

      if (!comparison || !comparison.bestDeal) {
        return;
      }

      // Check if this triggers any price drop alerts
      const alerts = await this.evaluatePriceDropAlerts(watch, comparison);

      // Send alerts if any were generated
      for (const alert of alerts) {
        await this.sendPriceDropAlert(alert);
      }
    } catch (error) {
      logger.error(`Error processing price change for watch ${watch.id}:`, error);
    }
  }

  /**
   * Evaluate if price changes should trigger alerts
   */
  private static async evaluatePriceDropAlerts(watch: any, comparison: any): Promise<PriceDropAlert[]> {
    const alerts: PriceDropAlert[] = [];

    // Get user's price drop preferences
    const preferences = await this.getUserPriceDropPreferences(watch.user_id);

    // Check each retailer for price drop opportunities
    for (const retailer of comparison.retailers) {
      if (!retailer.inStock) continue;

      // Check if price is within user's maximum price threshold
      if (watch.max_price && retailer.price > watch.max_price) {
        continue;
      }

      // Check for significant price drops
      if (retailer.savings && retailer.savingsPercentage) {
        const meetsThreshold = this.meetsPriceDropThreshold(
          retailer,
          preferences,
          watch.subscription_tier
        );

        if (meetsThreshold) {
          // Check if we haven't alerted for this price recently
          const recentAlert = await this.hasRecentPriceAlert(
            watch.user_id,
            watch.product_id,
            retailer.retailerId,
            retailer.price
          );

          if (!recentAlert) {
            alerts.push({
              userId: watch.user_id,
              productId: watch.product_id,
              retailerId: retailer.retailerId,
              watchId: watch.id,
              currentPrice: retailer.price,
              previousPrice: retailer.originalPrice || retailer.price,
              savingsAmount: retailer.savings,
              savingsPercentage: retailer.savingsPercentage,
              dealScore: retailer.dealScore || 0,
              alertType: this.determineAlertType(retailer, comparison.historicalContext)
            });
          }
        }
      }

      // Check if this is the best deal across retailers
      if (retailer.retailerId === comparison.bestDeal.retailerId && 
          comparison.retailers.length > 1) {
        
        const isBestDealAlert = await this.shouldSendBestDealAlert(
          watch,
          retailer,
          comparison
        );

        if (isBestDealAlert) {
          alerts.push({
            userId: watch.user_id,
            productId: watch.product_id,
            retailerId: retailer.retailerId,
            watchId: watch.id,
            currentPrice: retailer.price,
            previousPrice: comparison.averagePrice,
            savingsAmount: comparison.averagePrice - retailer.price,
            savingsPercentage: ((comparison.averagePrice - retailer.price) / comparison.averagePrice) * 100,
            dealScore: retailer.dealScore || 0,
            alertType: 'best_deal'
          });
        }
      }
    }

    return alerts;
  }

  /**
   * Get user's price drop preferences
   */
  private static async getUserPriceDropPreferences(userId: string): Promise<any> {
    const defaultPreferences = {
      minSavingsPercentage: 10,
      minSavingsAmount: 1.00,
      onlyBestDeals: false,
      alertCooldownHours: 24
    };

    try {
      const userPrefs = await this.db('users')
        .select('preferences')
        .where('id', userId)
        .first();

      if (userPrefs?.preferences?.priceDropAlerts) {
        return { ...defaultPreferences, ...userPrefs.preferences.priceDropAlerts };
      }

      return defaultPreferences;
    } catch (error) {
      logger.error(`Error getting price drop preferences for user ${userId}:`, error);
      return defaultPreferences;
    }
  }

  /**
   * Check if retailer price meets user's threshold for alerts
   */
  private static meetsPriceDropThreshold(
    retailer: any,
    preferences: any,
    subscriptionTier: string
  ): boolean {
    // Pro users get more sensitive thresholds
    const minSavingsPercentage = subscriptionTier === 'pro' ? 
      Math.max(5, preferences.minSavingsPercentage * 0.7) : 
      preferences.minSavingsPercentage;

    const minSavingsAmount = subscriptionTier === 'pro' ? 
      Math.max(0.50, preferences.minSavingsAmount * 0.7) : 
      preferences.minSavingsAmount;

    return retailer.savingsPercentage >= minSavingsPercentage && 
           retailer.savings >= minSavingsAmount;
  }

  /**
   * Check if we've sent a recent alert for this price
   */
  private static async hasRecentPriceAlert(
    userId: string,
    productId: string,
    retailerId: string,
    currentPrice: number
  ): Promise<boolean> {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const recentAlert = await this.db('alerts')
      .where('user_id', userId)
      .where('product_id', productId)
      .where('retailer_id', retailerId)
      .where('type', 'price_drop')
      .where('created_at', '>=', twentyFourHoursAgo)
      .whereRaw('(data->\'currentPrice\')::decimal = ?', [currentPrice])
      .first();

    return !!recentAlert;
  }

  /**
   * Determine the type of price drop alert
   */
  private static determineAlertType(retailer: any, historicalContext: any): 'price_drop' | 'historical_low' {
    if (historicalContext?.isAtHistoricalLow) {
      return 'historical_low';
    }
    return 'price_drop';
  }

  /**
   * Check if we should send a best deal alert
   */
  private static async shouldSendBestDealAlert(
    watch: any,
    retailer: any,
    comparison: any
  ): Promise<boolean> {
    // Only send best deal alerts for Pro users or if explicitly enabled
    if (watch.subscription_tier !== 'pro') {
      return false;
    }

    // Must be significantly better than average
    const savingsFromAverage = comparison.averagePrice - retailer.price;
    const savingsPercentage = (savingsFromAverage / comparison.averagePrice) * 100;

    if (savingsPercentage < 5) {
      return false;
    }

    // Check if we haven't sent a best deal alert recently
    const recentBestDealAlert = await this.hasRecentBestDealAlert(
      watch.user_id,
      watch.product_id
    );

    return !recentBestDealAlert;
  }

  /**
   * Check for recent best deal alerts
   */
  private static async hasRecentBestDealAlert(
    userId: string,
    productId: string
  ): Promise<boolean> {
    const twelveHoursAgo = new Date();
    twelveHoursAgo.setHours(twelveHoursAgo.getHours() - 12);

    const recentAlert = await this.db('alerts')
      .where('user_id', userId)
      .where('product_id', productId)
      .where('type', 'price_drop')
      .whereRaw('data->\'alertType\' = ?', ['best_deal'])
      .where('created_at', '>=', twelveHoursAgo)
      .first();

    return !!recentAlert;
  }

  /**
   * Send price drop alert using the existing alert system
   */
  private static async sendPriceDropAlert(alert: PriceDropAlert): Promise<void> {
    try {
      const alertData = {
        alertType: alert.alertType,
        currentPrice: alert.currentPrice,
        previousPrice: alert.previousPrice,
        savingsAmount: alert.savingsAmount,
        savingsPercentage: alert.savingsPercentage,
        dealScore: alert.dealScore,
        timestamp: new Date().toISOString()
      };

      await AlertProcessingService.generateAlert({
        userId: alert.userId,
        productId: alert.productId,
        retailerId: alert.retailerId,
        watchId: alert.watchId,
        type: 'price_drop',
        priority: this.determinePriority(alert),
        data: alertData
      });

      logger.info(`Price drop alert sent for user ${alert.userId}, product ${alert.productId}`);
    } catch (error) {
      logger.error('Error sending price drop alert:', error);
      throw error;
    }
  }

  /**
   * Determine alert priority based on deal quality
   */
  private static determinePriority(alert: PriceDropAlert): 'low' | 'medium' | 'high' | 'urgent' {
    if (alert.alertType === 'historical_low' || alert.dealScore >= 90) {
      return 'urgent';
    }
    if (alert.savingsPercentage >= 25 || alert.dealScore >= 80) {
      return 'high';
    }
    if (alert.savingsPercentage >= 15 || alert.dealScore >= 70) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Set user's price drop alert preferences
   */
  static async setUserPriceDropPreferences(
    userId: string,
    preferences: {
      minSavingsPercentage?: number;
      minSavingsAmount?: number;
      onlyBestDeals?: boolean;
      alertCooldownHours?: number;
    }
  ): Promise<void> {
    try {
      // Get current user preferences
      const user = await this.db('users')
        .select('preferences')
        .where('id', userId)
        .first();

      const currentPreferences = user?.preferences || {};
      const updatedPreferences = {
        ...currentPreferences,
        priceDropAlerts: {
          ...currentPreferences.priceDropAlerts,
          ...preferences
        }
      };

      await this.db('users')
        .where('id', userId)
        .update({
          preferences: JSON.stringify(updatedPreferences),
          updated_at: new Date()
        });

      logger.info(`Updated price drop preferences for user ${userId}`);
    } catch (error) {
      logger.error(`Error setting price drop preferences for user ${userId}:`, error);
      throw handleDatabaseError(error);
    }
  }

  /**
   * Get price drop statistics for admin dashboard
   */
  static async getPriceDropStatistics(days: number = 7): Promise<{
    totalAlerts: number;
    alertsByType: Record<string, number>;
    averageSavings: number;
    topDeals: any[];
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get total price drop alerts
      const totalAlertsResult = await this.db('alerts')
        .count('* as count')
        .where('type', 'price_drop')
        .where('created_at', '>=', startDate)
        .first();

      const totalAlerts = parseInt(totalAlertsResult?.count || '0', 10);

      // Get alerts by type
      const alertsByTypeResult = await this.db('alerts')
        .select(this.db.raw('data->\'alertType\' as alert_type'))
        .count('* as count')
        .where('type', 'price_drop')
        .where('created_at', '>=', startDate)
        .groupBy(this.db.raw('data->\'alertType\''));

      const alertsByType: Record<string, number> = {};
      alertsByTypeResult.forEach(row => {
        alertsByType[row.alert_type] = parseInt(row.count, 10);
      });

      // Get average savings
      const avgSavingsResult = await this.db('alerts')
        .avg(this.db.raw('(data->\'savingsAmount\')::decimal as avg_savings'))
        .where('type', 'price_drop')
        .where('created_at', '>=', startDate)
        .first();

      const averageSavings = parseFloat(avgSavingsResult?.avg_savings || '0');

      // Get top deals
      const topDeals = await this.db('alerts')
        .select(
          'alerts.*',
          'products.name as product_name',
          'retailers.name as retailer_name'
        )
        .leftJoin('products', 'alerts.product_id', 'products.id')
        .leftJoin('retailers', 'alerts.retailer_id', 'retailers.id')
        .where('alerts.type', 'price_drop')
        .where('alerts.created_at', '>=', startDate)
        .orderBy(this.db.raw('(alerts.data->\'dealScore\')::decimal'), 'desc')
        .limit(10);

      return {
        totalAlerts,
        alertsByType,
        averageSavings,
        topDeals
      };
    } catch (error) {
      logger.error('Error getting price drop statistics:', error);
      throw handleDatabaseError(error);
    }
  }
}