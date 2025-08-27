import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { Watch } from '../models/Watch';
import { Alert } from '../models/Alert';
import { Product } from '../models/Product';
import { logger } from '../utils/logger';

// Extend Request interface to include authenticated user
interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role?: string;
  };
}

// Constants for dashboard configuration
const DASHBOARD_CONFIG = {
  DEFAULT_RECENT_ALERTS_LIMIT: 10,
  DEFAULT_WATCHED_PRODUCTS_LIMIT: 20,
  DEFAULT_TOP_PRODUCTS_LIMIT: 5,
  DEFAULT_PREDICTIVE_INSIGHTS_LIMIT: 50,
  UPDATES_DEFAULT_TIMEFRAME_MINUTES: 5,
  INSIGHTS_ALERT_HISTORY_DAYS: 30,
  PRICE_FORECAST: {
    NEXT_WEEK_VARIANCE: { MIN: 0.95, MAX: 1.05 },
    NEXT_MONTH_VARIANCE: { MIN: 0.9, MAX: 1.1 },
    MIN_CONFIDENCE: 0.6,
    MAX_CONFIDENCE: 0.95
  },
  SELLOUT_RISK: {
    ALERT_MULTIPLIER: 5,
    HIGH_RISK_THRESHOLD: 5,
    TIMEFRAMES: {
      HIGH: '24-48 hours',
      NORMAL: '3-7 days'
    }
  },
  ROI_ESTIMATE: {
    SHORT_TERM_RANGE: { MIN: -5, MAX: 15 },
    LONG_TERM_RANGE: { MIN: 10, MAX: 60 }
  }
} as const;

// Type definitions for better type safety
interface ProductInsights {
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
  updatedAt: string;
}

interface CollectionGaps {
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

/**
 * Get comprehensive dashboard data for the authenticated user
 */
export const getDashboardData = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id;

    // Get user statistics in parallel
    const [userStats, watchStats, alertStats, recentAlerts, watchedProducts] = await Promise.all([
      User.getUserStats(userId),
      Watch.getUserWatchStats(userId),
      Alert.getUserAlertStats(userId),
      Alert.findByUserId(userId, { page: 1, limit: DASHBOARD_CONFIG.DEFAULT_RECENT_ALERTS_LIMIT }),
      getWatchedProductsWithInsights(userId)
    ]);

    // Combine all dashboard data
    const dashboardData = {
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

    logger.info('Dashboard data retrieved', { userId, watchCount: watchStats.active });

    res.status(200).json({
      dashboard: dashboardData
    });
  } catch (error) {
    logger.error('Error retrieving dashboard data', {
      userId: req.user.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    next(error);
  }
};

/**
 * Get predictive insights for user's watched products
 */
export const getPredictiveInsights = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id;
    const { productIds } = req.query;

    let targetProductIds: string[] = [];

    if (productIds && typeof productIds === 'string') {
      targetProductIds = productIds.split(',').filter(id => id.trim().length > 0);
      
      // Validate product IDs format (basic validation)
      const invalidIds = targetProductIds.filter(id => !/^[a-zA-Z0-9-_]+$/.test(id));
      if (invalidIds.length > 0) {
        res.status(400).json({
          error: {
            code: 'INVALID_PRODUCT_IDS',
            message: 'Invalid product ID format',
            details: { invalidIds },
            timestamp: new Date().toISOString()
          }
        });
        return;
      }
    } else {
      // Get user's watched products
      const watches = await Watch.findByUserId(userId, { limit: DASHBOARD_CONFIG.DEFAULT_PREDICTIVE_INSIGHTS_LIMIT });
      targetProductIds = watches.data.map(watch => watch.product_id);
    }

    // Generate predictive insights for each product
    const insights = await Promise.all(
      targetProductIds.map(async (productId) => {
        return generateProductInsights(productId);
      })
    );

    res.status(200).json({
      insights: insights.filter(insight => insight !== null)
    });
  } catch (error) {
    logger.error('Error retrieving predictive insights', {
      userId: req.user.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    next(error);
  }
};

/**
 * Get portfolio tracking data
 */
export const getPortfolioData = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id;

    // Get user's collection data (this would be expanded with actual purchase tracking)
    const [watchStats, alertStats, topProducts] = await Promise.all([
      Watch.getUserWatchStats(userId),
      Alert.getUserAlertStats(userId),
      getTopWatchedProducts(userId)
    ]);

    // Calculate portfolio metrics
    const portfolioData = {
      totalValue: 0, // Would be calculated from actual purchases
      totalItems: watchStats.active,
      valueChange: {
        amount: 0,
        percentage: 0,
        period: '30d'
      },
      topHoldings: topProducts,
      gapAnalysis: await getCollectionGaps(userId),
      performance: {
        alertsGenerated: alertStats.total,
        successfulPurchases: 0, // Would track actual purchases
        missedOpportunities: 0, // Would track expired alerts not acted upon
        averageResponseTime: calculateAverageResponseTime(alertStats)
      }
    };

    res.status(200).json({
      portfolio: portfolioData
    });
  } catch (error) {
    logger.error('Error retrieving portfolio data', {
      userId: req.user.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    next(error);
  }
};

/**
 * Get real-time dashboard updates
 */
export const getDashboardUpdates = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id;
    const { since } = req.query;
    
    const sinceDate = since ? new Date(since as string) : new Date(Date.now() - DASHBOARD_CONFIG.UPDATES_DEFAULT_TIMEFRAME_MINUTES * 60 * 1000);

    // Get recent updates
    const [recentAlerts, recentWatchUpdates] = await Promise.all([
      Alert.findByUserId(userId, { page: 1, limit: 5 }),
      getRecentWatchUpdates(userId, sinceDate)
    ]);

    const updates = {
      newAlerts: recentAlerts.data.filter(alert => new Date(alert.created_at) > sinceDate),
      watchUpdates: recentWatchUpdates,
      timestamp: new Date().toISOString()
    };

    res.status(200).json({
      updates
    });
  } catch (error) {
    logger.error('Error retrieving dashboard updates', {
      userId: req.user.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    next(error);
  }
};

// Helper functions

/**
 * Get watched products with predictive insights
 * @param userId - The authenticated user's ID
 * @returns Promise resolving to array of watched products with insights
 */
async function getWatchedProductsWithInsights(userId: string) {
  const watches = await Watch.findByUserId(userId, { limit: DASHBOARD_CONFIG.DEFAULT_WATCHED_PRODUCTS_LIMIT });
  
  const productsWithInsights = await Promise.all(
    watches.data.map(async (watch) => {
      const product = await Product.findById(watch.product_id);
      const insights = await generateProductInsights(watch.product_id);
      
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
 * @param productId - The product ID to generate insights for
 * @returns Promise resolving to ProductInsights or null if product not found
 */
async function generateProductInsights(productId: string): Promise<ProductInsights | null> {
  try {
    // This would integrate with actual ML models
    // For now, we'll generate mock insights based on available data
    
    const product = await Product.findById(productId);
    if (!product) return null;

    const recentAlerts = await Alert.findByProductId(productId, { days: DASHBOARD_CONFIG.INSIGHTS_ALERT_HISTORY_DAYS });
    const alertCount = recentAlerts.length;
    
    // Mock predictive data - in production this would come from ML models
    const productData = product as any; // TODO: Add proper Product interface
    const { PRICE_FORECAST, SELLOUT_RISK, ROI_ESTIMATE } = DASHBOARD_CONFIG;
    
    const insights: ProductInsights = {
      productId,
      productName: productData.name || 'Unknown Product',
      priceForcast: {
        nextWeek: productData.msrp ? 
          productData.msrp * (PRICE_FORECAST.NEXT_WEEK_VARIANCE.MIN + Math.random() * 0.1) : 0,
        nextMonth: productData.msrp ? 
          productData.msrp * (PRICE_FORECAST.NEXT_MONTH_VARIANCE.MIN + Math.random() * 0.2) : 0,
        confidence: Math.max(PRICE_FORECAST.MIN_CONFIDENCE, Math.min(PRICE_FORECAST.MAX_CONFIDENCE, alertCount / 10))
      },
      selloutRisk: {
        score: Math.min(100, alertCount * SELLOUT_RISK.ALERT_MULTIPLIER + Math.random() * 20),
        timeframe: alertCount > SELLOUT_RISK.HIGH_RISK_THRESHOLD ? 
          SELLOUT_RISK.TIMEFRAMES.HIGH : SELLOUT_RISK.TIMEFRAMES.NORMAL,
        confidence: Math.max(0.5, Math.min(0.9, alertCount / 15))
      },
      roiEstimate: {
        shortTerm: Math.random() * (ROI_ESTIMATE.SHORT_TERM_RANGE.MAX - ROI_ESTIMATE.SHORT_TERM_RANGE.MIN) + ROI_ESTIMATE.SHORT_TERM_RANGE.MIN,
        longTerm: Math.random() * (ROI_ESTIMATE.LONG_TERM_RANGE.MAX - ROI_ESTIMATE.LONG_TERM_RANGE.MIN) + ROI_ESTIMATE.LONG_TERM_RANGE.MIN,
        confidence: Math.max(0.4, Math.min(0.8, (productData.popularity_score || 0) / 100))
      },
      hypeScore: Math.min(100, (productData.popularity_score || 0) + alertCount * 2),
      updatedAt: new Date().toISOString()
    };

    return insights;
  } catch (error) {
    logger.error('Error generating product insights', { productId, error });
    return null;
  }
}

/**
 * Get top watched products for a user
 * @param userId - The authenticated user's ID
 * @returns Promise resolving to array of top watched products with insights
 */
async function getTopWatchedProducts(userId: string) {
  const watchStats = await Watch.getUserWatchStats(userId);
  
  const topProducts = await Promise.all(
    watchStats.topProducts.slice(0, DASHBOARD_CONFIG.DEFAULT_TOP_PRODUCTS_LIMIT).map(async (item) => {
      const product = await Product.findById(item.product_id);
      return {
        product,
        alertCount: item.alert_count,
        insights: await generateProductInsights(item.product_id)
      };
    })
  );

  return topProducts.filter(item => item.product !== null);
}

/**
 * Get collection gaps analysis
 * @param userId - The authenticated user's ID
 * @returns Promise resolving to collection gaps analysis
 */
async function getCollectionGaps(userId: string): Promise<CollectionGaps> {
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
 * @param alertStats - Alert statistics containing click-through rate
 * @returns Human-readable average response time string
 */
function calculateAverageResponseTime(alertStats: { clickThroughRate: number }): string {
  // This would calculate actual response times
  // For now, return a reasonable estimate
  return alertStats.clickThroughRate > 50 ? '< 2 minutes' : '< 5 minutes';
}

/**
 * Get recent watch updates
 * @param userId - The authenticated user's ID
 * @param since - Date to filter updates from
 * @returns Promise resolving to array of recent watch updates
 */
async function getRecentWatchUpdates(userId: string, since: Date) {
  // This would track watch modifications
  // For now, return empty array
  return [];
}