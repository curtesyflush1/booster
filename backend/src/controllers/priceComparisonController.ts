import { Request, Response } from 'express';
import { PriceComparisonService } from '../services/priceComparisonService';
import { logger } from '../utils/logger';
import { handleDatabaseError } from '../config/database';

export class PriceComparisonController {
  /**
   * Get price comparison for a single product
   * GET /api/price-comparison/products/:productId
   */
  static async getProductComparison(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const { includeHistory } = req.query;

      if (!productId) {
        res.status(400).json({
          error: {
            code: 'MISSING_PRODUCT_ID',
            message: 'Product ID is required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const includeHistoricalContext = includeHistory === 'true';
      const comparison = await PriceComparisonService.getProductPriceComparison(
        productId,
        includeHistoricalContext
      );

      if (!comparison) {
        res.status(404).json({
          error: {
            code: 'PRODUCT_NOT_FOUND',
            message: 'Product not found or no pricing data available',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      res.json({
        success: true,
        data: comparison,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error getting product price comparison:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get price comparison',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  /**
   * Get price comparisons for multiple products
   * POST /api/price-comparison/products/batch
   */
  static async getBatchComparisons(req: Request, res: Response): Promise<void> {
    try {
      const { productIds, includeHistory } = req.body;

      if (!Array.isArray(productIds) || productIds.length === 0) {
        res.status(400).json({
          error: {
            code: 'INVALID_PRODUCT_IDS',
            message: 'Product IDs must be a non-empty array',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      if (productIds.length > 50) {
        res.status(400).json({
          error: {
            code: 'TOO_MANY_PRODUCTS',
            message: 'Maximum 50 products allowed per batch request',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const includeHistoricalContext = includeHistory === true;
      const comparisons = await PriceComparisonService.getMultipleProductComparisons(
        productIds,
        includeHistoricalContext
      );

      res.json({
        success: true,
        data: comparisons,
        count: comparisons.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error getting batch price comparisons:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get batch price comparisons',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  /**
   * Get price history for a product
   * GET /api/price-comparison/products/:productId/history
   */
  static async getProductPriceHistory(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const { days = '30', retailerId } = req.query;

      if (!productId) {
        res.status(400).json({
          error: {
            code: 'MISSING_PRODUCT_ID',
            message: 'Product ID is required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const daysNumber = parseInt(days as string, 10);
      if (isNaN(daysNumber) || daysNumber < 1 || daysNumber > 365) {
        res.status(400).json({
          error: {
            code: 'INVALID_DAYS',
            message: 'Days must be a number between 1 and 365',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const history = await PriceComparisonService.getProductPriceHistory(
        productId,
        daysNumber,
        retailerId as string
      );

      res.json({
        success: true,
        data: history,
        count: history.length,
        timeframe: daysNumber,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error getting product price history:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get price history',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  /**
   * Get current deals across all products
   * GET /api/price-comparison/deals
   */
  static async getCurrentDeals(req: Request, res: Response): Promise<void> {
    try {
      const {
        minSavings = '10',
        minScore = '70',
        includeOutOfStock = 'false',
        retailers,
        limit = '50'
      } = req.query;

      const minSavingsPercentage = parseFloat(minSavings as string);
      const minDealScore = parseFloat(minScore as string);
      const includeOutOfStockItems = includeOutOfStock === 'true';
      const limitNumber = parseInt(limit as string, 10);

      if (isNaN(minSavingsPercentage) || minSavingsPercentage < 0) {
        res.status(400).json({
          error: {
            code: 'INVALID_MIN_SAVINGS',
            message: 'Minimum savings percentage must be a non-negative number',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      if (isNaN(minDealScore) || minDealScore < 0 || minDealScore > 100) {
        res.status(400).json({
          error: {
            code: 'INVALID_DEAL_SCORE',
            message: 'Deal score must be a number between 0 and 100',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      if (isNaN(limitNumber) || limitNumber < 1 || limitNumber > 100) {
        res.status(400).json({
          error: {
            code: 'INVALID_LIMIT',
            message: 'Limit must be a number between 1 and 100',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      let retailerIds: string[] | undefined;
      if (retailers) {
        retailerIds = Array.isArray(retailers) ? retailers as string[] : [retailers as string];
      }

      const options: any = {
        minSavingsPercentage,
        minDealScore,
        includeOutOfStock: includeOutOfStockItems,
        limit: limitNumber
      };

      if (retailerIds) {
        options.retailerIds = retailerIds;
      }

      const deals = await PriceComparisonService.identifyDeals(options);

      res.json({
        success: true,
        data: deals,
        count: deals.length,
        filters: {
          minSavingsPercentage,
          minDealScore,
          includeOutOfStock: includeOutOfStockItems,
          retailers: retailerIds,
          limit: limitNumber
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error getting current deals:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get current deals',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  /**
   * Get price trends for a product
   * GET /api/price-comparison/products/:productId/trends
   */
  static async getProductTrends(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const { days = '7' } = req.query;

      if (!productId) {
        res.status(400).json({
          error: {
            code: 'MISSING_PRODUCT_ID',
            message: 'Product ID is required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const daysNumber = parseInt(days as string, 10);
      if (isNaN(daysNumber) || daysNumber < 1 || daysNumber > 90) {
        res.status(400).json({
          error: {
            code: 'INVALID_DAYS',
            message: 'Days must be a number between 1 and 90',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const trends = await PriceComparisonService.analyzePriceTrends(productId, daysNumber);

      res.json({
        success: true,
        data: trends,
        count: trends.length,
        timeframe: daysNumber,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error getting product trends:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get price trends',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  /**
   * Get best deals for authenticated user's watchlist
   * GET /api/price-comparison/my-deals
   */
  static async getUserDeals(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const { minSavings = '5', limit = '20' } = req.query;

      const minSavingsPercentage = parseFloat(minSavings as string);
      const limitNumber = parseInt(limit as string, 10);

      if (isNaN(minSavingsPercentage) || minSavingsPercentage < 0) {
        res.status(400).json({
          error: {
            code: 'INVALID_MIN_SAVINGS',
            message: 'Minimum savings percentage must be a non-negative number',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      if (isNaN(limitNumber) || limitNumber < 1 || limitNumber > 50) {
        res.status(400).json({
          error: {
            code: 'INVALID_LIMIT',
            message: 'Limit must be a number between 1 and 50',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const deals = await PriceComparisonService.getBestDealsForUser(userId, {
        minSavingsPercentage,
        limit: limitNumber
      });

      res.json({
        success: true,
        data: deals,
        count: deals.length,
        filters: {
          minSavingsPercentage,
          limit: limitNumber
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error getting user deals:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get user deals',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }
}