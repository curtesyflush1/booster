import { User } from '../models/User';
import { Watch } from '../models/Watch';
import { Alert } from '../models/Alert';
import { Product } from '../models/Product';
import { logger } from '../utils/logger';
import { ModelFactory } from './ml/ModelFactory';
import { DASHBOARD_CONFIG } from '../config/dashboardConfig';

// Type definitions for better type safety
export interface ProductInsights {
  productId: string;
  productName: string;
  priceForcast: {
    nextWeek: number;
    nextMonth: number;
    confidence: number;
  };
  selloutRisk: {
    score: number;
    timeframe: string;
    confidence: number;
  };
  roiEstimate: {
    shortTerm: number;
    longTerm: number;
    confidence: number;
  };
  hypeScore: number;
  // Aggregated metrics from user-reported purchases. These contain no PII.
  purchaseSignals?: {
    averagePaidPrice: number;           // average price users actually paid
    avgDeltaToMsrpPct: number;          // (MSRP - avgPaid) / MSRP
    averageLeadTimeHours: number | null; // avg hours from alert_at to purchase
    sampleSize: number;                 // number of purchases considered
  };
  updatedAt: string;
}

export interface CollectionGaps {
  missingSets: Array<{
    setName: string;
    completionPercentage: number;
    missingItems: number;
  }>;
  recommendedPurchases: Array<{
    productId: string;
    priority: 'high' | 'medium' | 'low';
    reason: string;
  }>;
}

export interface DashboardData {
  stats: {
    totalWatches: number;
    unreadAlerts: number;
    totalAlerts: number;
    successfulPurchases: number;
    clickThroughRate: number;
    recentAlerts: number;
  };
  recentAlerts: any[];
  watchedProducts: any[];
  insights: {
    topPerformingProducts: any[];
    alertTrends: any;
    engagementMetrics: {
      clickThroughRate: number;
      totalClicks: number;
      averageResponseTime: string;
    };
  };
}

export interface PortfolioData {
  totalValue: number;
  totalItems: number;
  valueChange: {
    amount: number;
    percentage: number;
    period: string;
  };
  topHoldings: any[];
  gapAnalysis: CollectionGaps;
  performance: {
    alertsGenerated: number;
    successfulPurchases: number;
    missedOpportunities: number;
    averageResponseTime: string;
  };
}

/**
 * Dashboard service for handling dashboard-related business logic
 */
export class DashboardService {
  /**
   * Get comprehensive dashboard data for a user
   */
  static async getDashboardData(userId: string): Promise<DashboardData> {
    try {
      // Get user statistics in parallel for better performance
      const [watchStats, alertStats, recentAlerts, watchedProducts] = await Promise.all([
        Watch.getUserWatchStats(userId),
        Alert.getUserAlertStats(userId),
        Alert.findByUserId(userId, { page: 1, limit: DASHBOARD_CONFIG.DEFAULT_RECENT_ALERTS_LIMIT }),
        this.getWatchedProductsWithInsights(userId)
      ]);

      return {
        stats: {
          totalWatches: watchStats.active,
          unreadAlerts: alertStats.unread,
          totalAlerts: alertStats.total,
          successfulPurchases: 0, // Would be calculated from actual purchase tracking
          clickThroughRate: alertStats.clickThroughRate,
          recentAlerts: alertStats.recentAlerts
        },
        recentAlerts: recentAlerts.data,
        watchedProducts: watchedProducts,
        insights: {
          topPerformingProducts: watchStats.topProducts,
          alertTrends: alertStats.byType,
          engagementMetrics: {
            clickThroughRate: alertStats.clickThroughRate,
            totalClicks: alertStats.total,
            averageResponseTime: '< 5 seconds' // This would come from actual metrics
          }
        }
      };
    } catch (error) {
      logger.error('Error getting dashboard data', { userId, error });
      throw error;
    }
  }

  /**
   * Get predictive insights for products
   */
  static async getPredictiveInsights(userId: string, productIds?: string[]): Promise<ProductInsights[]> {
    try {
      let targetProductIds: string[] = [];

      if (productIds && productIds.length > 0) {
        // Validate product IDs format
        const invalidIds = productIds.filter(id => !/^[a-zA-Z0-9-_]+$/.test(id));
        if (invalidIds.length > 0) {
          throw new Error(`Invalid product ID format: ${invalidIds.join(', ')}`);
        }
        targetProductIds = productIds;
      } else {
        // Get user's watched products
        const watches = await Watch.findByUserId(userId, { limit: DASHBOARD_CONFIG.DEFAULT_PREDICTIVE_INSIGHTS_LIMIT });
        targetProductIds = watches.data.map(watch => watch.product_id);
      }

      // Generate predictive insights for each product
      const insights = await Promise.all(
        targetProductIds.map(async (productId) => {
          return this.generateProductInsights(productId);
        })
      );

      return insights.filter(insight => insight !== null) as ProductInsights[];
    } catch (error) {
      logger.error('Error getting predictive insights', { userId, error });
      throw error;
    }
  }

  /**
   * Get portfolio tracking data
   */
  static async getPortfolioData(userId: string): Promise<PortfolioData> {
    try {
      // Get user's collection data in parallel
      const [watchStats, alertStats, topProducts] = await Promise.all([
        Watch.getUserWatchStats(userId),
        Alert.getUserAlertStats(userId),
        this.getTopWatchedProducts(userId)
      ]);

      return {
        totalValue: 0, // Would be calculated from actual purchases
        totalItems: watchStats.active,
        valueChange: {
          amount: 0,
          percentage: 0,
          period: '30d'
        },
        topHoldings: topProducts,
        gapAnalysis: await this.getCollectionGaps(userId),
        performance: {
          alertsGenerated: alertStats.total,
          successfulPurchases: 0, // Would track actual purchases
          missedOpportunities: 0, // Would track expired alerts not acted upon
          averageResponseTime: this.calculateAverageResponseTime(alertStats)
        }
      };
    } catch (error) {
      logger.error('Error getting portfolio data', { userId, error });
      throw error;
    }
  }

  /**
   * Get real-time dashboard updates
   */
  static async getDashboardUpdates(userId: string, since?: Date) {
    try {
      const sinceDate = since || new Date(Date.now() - DASHBOARD_CONFIG.UPDATES_DEFAULT_TIMEFRAME_MINUTES * 60 * 1000);

      // Get recent updates in parallel with database-level filtering
      const [recentAlerts, recentWatchUpdates] = await Promise.all([
        Alert.findByUserId(userId, {
          page: 1,
          limit: 5,
          start_date: sinceDate  // Use database-level filtering instead of in-memory filtering
        }),
        this.getRecentWatchUpdates(userId, sinceDate)
      ]);

      return {
        newAlerts: recentAlerts.data, // No need to filter - already filtered at database level
        watchUpdates: recentWatchUpdates,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting dashboard updates', { userId, since, error });
      throw error;
    }
  }

  // Private helper methods

  /**
   * Get watched products with predictive insights
   */
  private static async getWatchedProductsWithInsights(userId: string) {
    const watches = await Watch.findByUserId(userId, { limit: DASHBOARD_CONFIG.DEFAULT_WATCHED_PRODUCTS_LIMIT });
    
    const productsWithInsights = await Promise.all(
      watches.data.map(async (watch) => {
        const [product, insights] = await Promise.all([
          Product.findById(watch.product_id),
          this.generateProductInsights(watch.product_id)
        ]);
        
        return {
          watch,
          product,
          insights
        };
      })
    );

    return productsWithInsights.filter(item => item.product !== null);
  }

  /**
   * Generate predictive insights for a product
   */
  private static async generateProductInsights(productId: string): Promise<ProductInsights | null> {
    try {
      const runner = ModelFactory.getActiveRunner();
      return await runner.predict(productId);
    } catch (error) {
      logger.error('Error generating product insights', { productId, error });
      return null;
    }
  }

  /**
   * Get top watched products for a user
   */
  private static async getTopWatchedProducts(userId: string) {
    const watchStats = await Watch.getUserWatchStats(userId);
    
    const topProducts = await Promise.all(
      watchStats.topProducts.slice(0, DASHBOARD_CONFIG.DEFAULT_TOP_PRODUCTS_LIMIT).map(async (item) => {
        const [product, insights] = await Promise.all([
          Product.findById(item.product_id),
          this.generateProductInsights(item.product_id)
        ]);
        
        return {
          product,
          alertCount: item.alert_count,
          insights
        };
      })
    );

    return topProducts.filter(item => item.product !== null);
  }

  /**
   * Get collection gaps analysis
   */
  private static async getCollectionGaps(userId: string): Promise<CollectionGaps> {
    // This would analyze user's collection vs popular sets
    // For now, return mock data
    return {
      missingSets: [
        { setName: 'Paldea Evolved', completionPercentage: 75, missingItems: 12 },
        { setName: 'Scarlet & Violet Base', completionPercentage: 60, missingItems: 25 }
      ],
      recommendedPurchases: [
        { productId: 'mock-id-1', priority: 'high', reason: 'Completes popular set' },
        { productId: 'mock-id-2', priority: 'medium', reason: 'High ROI potential' }
      ]
    };
  }

  /**
   * Calculate average response time from alert stats
   */
  private static calculateAverageResponseTime(alertStats: { clickThroughRate: number }): string {
    // This would calculate actual response times
    // For now, return a reasonable estimate
    return alertStats.clickThroughRate > 50 ? '< 2 minutes' : '< 5 minutes';
  }

  /**
   * Get recent watch updates
   */
  private static async getRecentWatchUpdates(userId: string, since: Date) {
    logger.debug('Getting recent watch updates', { userId, since });
    // This would track watch modifications
    // For now, return empty array
    return [];
  }
}
