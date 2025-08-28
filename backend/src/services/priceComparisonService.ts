import { BaseModel } from '../models/BaseModel';
import { logger } from '../utils/logger';
import { handleDatabaseError } from '../config/database';

export interface PriceComparison {
  productId: string;
  productName: string;
  retailers: RetailerPrice[];
  bestDeal: RetailerPrice | null;
  averagePrice: number;
  priceRange: {
    min: number;
    max: number;
  };
  dealScore?: number; // For Pro users
  historicalContext?: {
    isAboveAverage: boolean;
    isAtHistoricalLow: boolean;
    averageHistoricalPrice: number;
    priceChangePercentage: number;
  };
}

export interface RetailerPrice {
  retailerId: string;
  retailerName: string;
  retailerSlug: string;
  price: number;
  originalPrice?: number;
  inStock: boolean;
  availabilityStatus: string;
  productUrl: string;
  cartUrl?: string;
  lastChecked: Date;
  dealScore?: number;
  savings?: number;
  savingsPercentage?: number;
}

export interface DealAlert {
  id: string;
  productId: string;
  retailerId: string;
  alertType: 'price_drop' | 'best_deal' | 'historical_low';
  currentPrice: number;
  previousPrice?: number;
  savingsAmount: number;
  savingsPercentage: number;
  dealScore: number;
  expiresAt?: Date;
}

export interface PriceHistoryPoint {
  date: Date;
  price: number;
  retailerId: string;
  retailerName: string;
  inStock: boolean;
}

export interface PriceTrend {
  productId: string;
  retailerId?: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercentage: number;
  timeframe: number; // days
  confidence: number; // 0-1
}

export class PriceComparisonService extends BaseModel<any> {
  protected static override tableName = 'product_availability';

  // Required abstract methods from BaseModel
  validate(data: any): any[] {
    return [];
  }

  sanitize(data: any): any {
    return data;
  }

  /**
   * Get price comparison across all retailers for a product
   */
  static async getProductPriceComparison(
    productId: string,
    includeHistoricalContext: boolean = false
  ): Promise<PriceComparison | null> {
    try {
      // Get current availability and pricing from all retailers
      const availabilityData = await this.db('product_availability')
        .select(
          'product_availability.*',
          'retailers.name as retailer_name',
          'retailers.slug as retailer_slug',
          'products.name as product_name'
        )
        .leftJoin('retailers', 'product_availability.retailer_id', 'retailers.id')
        .leftJoin('products', 'product_availability.product_id', 'products.id')
        .where('product_availability.product_id', productId)
        .where('retailers.is_active', true)
        .orderBy('product_availability.price', 'asc');

      if (availabilityData.length === 0) {
        return null;
      }

      const productName = availabilityData[0].product_name;

      // Transform to RetailerPrice format
      const retailers = availabilityData.map(item => {
        const savings = item.original_price ? item.original_price - item.price : 0;
        const savingsPercentage = item.original_price ? 
          ((item.original_price - item.price) / item.original_price) * 100 : 0;

        const retailerPrice: RetailerPrice = {
          retailerId: item.retailer_id,
          retailerName: item.retailer_name,
          retailerSlug: item.retailer_slug,
          price: parseFloat(item.price),
          inStock: item.in_stock,
          availabilityStatus: item.availability_status,
          productUrl: item.product_url,
          lastChecked: new Date(item.last_checked)
        };

        if (item.original_price) {
          retailerPrice.originalPrice = parseFloat(item.original_price);
        }
        if (item.cart_url) {
          retailerPrice.cartUrl = item.cart_url;
        }
        if (savings > 0) {
          retailerPrice.savings = savings;
        }
        if (savingsPercentage > 0) {
          retailerPrice.savingsPercentage = savingsPercentage;
        }

        return retailerPrice;
      });

      // Calculate price statistics
      const inStockPrices = retailers
        .filter(r => r.inStock && r.price > 0)
        .map(r => r.price);

      if (inStockPrices.length === 0) {
        return {
          productId,
          productName,
          retailers,
          bestDeal: null,
          averagePrice: 0,
          priceRange: { min: 0, max: 0 }
        };
      }

      const averagePrice = inStockPrices.reduce((sum, price) => sum + price, 0) / inStockPrices.length;
      const minPrice = Math.min(...inStockPrices);
      const maxPrice = Math.max(...inStockPrices);

      // Find best deal (lowest price among in-stock items)
      const bestDeal = retailers
        .filter(r => r.inStock && r.price > 0)
        .sort((a, b) => a.price - b.price)[0] || null;

      // Calculate deal scores for each retailer
      retailers.forEach(retailer => {
        if (retailer.inStock && retailer.price > 0) {
          retailer.dealScore = this.calculateDealScore(retailer, averagePrice, minPrice);
        }
      });

      const comparison: PriceComparison = {
        productId,
        productName,
        retailers,
        bestDeal,
        averagePrice,
        priceRange: { min: minPrice, max: maxPrice }
      };

      // Add historical context if requested
      if (includeHistoricalContext) {
        comparison.historicalContext = await this.getHistoricalPriceContext(productId);
      }

      return comparison;
    } catch (error) {
      logger.error(`Error getting price comparison for product ${productId}:`, error);
      throw handleDatabaseError(error);
    }
  }

  /**
   * Get price comparisons for multiple products
   */
  static async getMultipleProductComparisons(
    productIds: string[],
    includeHistoricalContext: boolean = false
  ): Promise<PriceComparison[]> {
    const comparisons: PriceComparison[] = [];

    // Process in batches to avoid overwhelming the database
    const batchSize = 10;
    for (let i = 0; i < productIds.length; i += batchSize) {
      const batch = productIds.slice(i, i + batchSize);
      const batchPromises = batch.map(productId => 
        this.getProductPriceComparison(productId, includeHistoricalContext)
      );

      const batchResults = await Promise.allSettled(batchPromises);
      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          comparisons.push(result.value);
        }
      });
    }

    return comparisons;
  }

  /**
   * Calculate deal score for a retailer (0-100, higher is better)
   */
  private static calculateDealScore(
    retailer: RetailerPrice,
    averagePrice: number,
    minPrice: number
  ): number {
    if (!retailer.inStock || retailer.price <= 0) {
      return 0;
    }

    let score = 0;

    // Base score: how close to minimum price (0-40 points)
    const priceRatio = retailer.price / minPrice;
    score += Math.max(0, 40 - (priceRatio - 1) * 40);

    // Availability bonus (0-20 points)
    if (retailer.availabilityStatus === 'in_stock') {
      score += 20;
    } else if (retailer.availabilityStatus === 'low_stock') {
      score += 10;
    }

    // Discount bonus (0-20 points)
    if (retailer.savings && retailer.savingsPercentage) {
      score += Math.min(20, retailer.savingsPercentage);
    }

    // Cart link bonus (0-10 points)
    if (retailer.cartUrl) {
      score += 10;
    }

    // Freshness bonus (0-10 points)
    const hoursOld = (Date.now() - retailer.lastChecked.getTime()) / (1000 * 60 * 60);
    if (hoursOld < 1) {
      score += 10;
    } else if (hoursOld < 6) {
      score += 5;
    }

    return Math.min(100, Math.max(0, Math.round(score)));
  }

  /**
   * Get historical price context for a product
   */
  private static async getHistoricalPriceContext(productId: string): Promise<{
    isAboveAverage: boolean;
    isAtHistoricalLow: boolean;
    averageHistoricalPrice: number;
    priceChangePercentage: number;
  }> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get historical prices for the last 30 days
      const historicalPrices = await this.db('price_history')
        .select('price', 'recorded_at')
        .where('product_id', productId)
        .where('in_stock', true)
        .where('recorded_at', '>=', thirtyDaysAgo)
        .orderBy('recorded_at', 'desc');

      if (historicalPrices.length === 0) {
        return {
          isAboveAverage: false,
          isAtHistoricalLow: false,
          averageHistoricalPrice: 0,
          priceChangePercentage: 0
        };
      }

      const prices = historicalPrices.map(h => parseFloat(h.price));
      const averageHistoricalPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      const minHistoricalPrice = Math.min(...prices);
      const currentPrice = prices[0] || 0; // Most recent price
      const oldestPrice = prices[prices.length - 1] || 0;

      const priceChangePercentage = oldestPrice > 0 ? 
        ((currentPrice - oldestPrice) / oldestPrice) * 100 : 0;

      return {
        isAboveAverage: currentPrice > averageHistoricalPrice,
        isAtHistoricalLow: Math.abs(currentPrice - minHistoricalPrice) < 0.01,
        averageHistoricalPrice,
        priceChangePercentage
      };
    } catch (error) {
      logger.error(`Error getting historical price context for product ${productId}:`, error);
      return {
        isAboveAverage: false,
        isAtHistoricalLow: false,
        averageHistoricalPrice: 0,
        priceChangePercentage: 0
      };
    }
  }

  /**
   * Get price history for a product across all retailers
   */
  static async getProductPriceHistory(
    productId: string,
    days: number = 30,
    retailerId?: string
  ): Promise<PriceHistoryPoint[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      let query = this.db('price_history')
        .select(
          'price_history.recorded_at as date',
          'price_history.price',
          'price_history.retailer_id',
          'price_history.in_stock',
          'retailers.name as retailer_name'
        )
        .leftJoin('retailers', 'price_history.retailer_id', 'retailers.id')
        .where('price_history.product_id', productId)
        .where('price_history.recorded_at', '>=', startDate)
        .orderBy('price_history.recorded_at', 'asc');

      if (retailerId) {
        query = query.where('price_history.retailer_id', retailerId);
      }

      const history = await query;

      return history.map(item => ({
        date: new Date(item.date),
        price: parseFloat(item.price),
        retailerId: item.retailer_id,
        retailerName: item.retailer_name,
        inStock: item.in_stock
      }));
    } catch (error) {
      logger.error(`Error getting price history for product ${productId}:`, error);
      throw handleDatabaseError(error);
    }
  }

  /**
   * Identify current deals based on price drops and historical data
   */
  static async identifyDeals(
    options: {
      minSavingsPercentage?: number;
      minDealScore?: number;
      includeOutOfStock?: boolean;
      retailerIds?: string[];
      limit?: number;
    } = {}
  ): Promise<DealAlert[]> {
    try {
      const {
        minSavingsPercentage = 10,
        minDealScore = 70,
        includeOutOfStock = false,
        retailerIds,
        limit = 50
      } = options;

      let query = this.db('product_availability')
        .select(
          'product_availability.*',
          'products.name as product_name',
          'retailers.name as retailer_name'
        )
        .leftJoin('products', 'product_availability.product_id', 'products.id')
        .leftJoin('retailers', 'product_availability.retailer_id', 'retailers.id')
        .where('retailers.is_active', true)
        .whereNotNull('product_availability.original_price')
        .whereRaw('product_availability.price < product_availability.original_price');

      if (!includeOutOfStock) {
        query = query.where('product_availability.in_stock', true);
      }

      if (retailerIds && retailerIds.length > 0) {
        query = query.whereIn('product_availability.retailer_id', retailerIds);
      }

      const deals = await query.limit(limit * 2); // Get more to filter

      const dealAlerts: DealAlert[] = [];

      for (const deal of deals) {
        const savings = parseFloat(deal.original_price) - parseFloat(deal.price);
        const savingsPercentage = (savings / parseFloat(deal.original_price)) * 100;

        if (savingsPercentage < minSavingsPercentage) {
          continue;
        }

        // Calculate deal score
        const dealScore = await this.calculateAdvancedDealScore(deal);
        
        if (dealScore < minDealScore) {
          continue;
        }

        dealAlerts.push({
          id: deal.id,
          productId: deal.product_id,
          retailerId: deal.retailer_id,
          alertType: 'price_drop',
          currentPrice: parseFloat(deal.price),
          previousPrice: parseFloat(deal.original_price),
          savingsAmount: savings,
          savingsPercentage,
          dealScore
        });

        if (dealAlerts.length >= limit) {
          break;
        }
      }

      return dealAlerts.sort((a, b) => b.dealScore - a.dealScore);
    } catch (error) {
      logger.error('Error identifying deals:', error);
      throw handleDatabaseError(error);
    }
  }

  /**
   * Calculate advanced deal score considering historical data
   */
  private static async calculateAdvancedDealScore(deal: any): Promise<number> {
    try {
      let score = 0;

      // Base discount score (0-30 points)
      const savings = parseFloat(deal.original_price) - parseFloat(deal.price);
      const savingsPercentage = (savings / parseFloat(deal.original_price)) * 100;
      score += Math.min(30, savingsPercentage);

      // Historical context (0-25 points)
      const historicalContext = await this.getHistoricalPriceContext(deal.product_id);
      if (historicalContext.isAtHistoricalLow) {
        score += 25;
      } else if (!historicalContext.isAboveAverage) {
        score += 15;
      }

      // Availability score (0-20 points)
      if (deal.in_stock) {
        if (deal.availability_status === 'in_stock') {
          score += 20;
        } else if (deal.availability_status === 'low_stock') {
          score += 15;
        }
      }

      // Cart link bonus (0-10 points)
      if (deal.cart_url) {
        score += 10;
      }

      // Freshness bonus (0-10 points)
      const hoursOld = (Date.now() - new Date(deal.last_checked).getTime()) / (1000 * 60 * 60);
      if (hoursOld < 1) {
        score += 10;
      } else if (hoursOld < 6) {
        score += 5;
      }

      // Product popularity bonus (0-5 points)
      const product = await this.db('products')
        .select('popularity_score')
        .where('id', deal.product_id)
        .first();
      
      if (product && product.popularity_score > 500) {
        score += 5;
      }

      return Math.min(100, Math.max(0, Math.round(score)));
    } catch (error) {
      logger.error('Error calculating advanced deal score:', error);
      return 0;
    }
  }

  /**
   * Analyze price trends for a product
   */
  static async analyzePriceTrends(
    productId: string,
    timeframeDays: number = 7
  ): Promise<PriceTrend[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - timeframeDays);

      const priceData = await this.db('price_history')
        .select('retailer_id', 'price', 'recorded_at')
        .where('product_id', productId)
        .where('in_stock', true)
        .where('recorded_at', '>=', startDate)
        .orderBy('recorded_at', 'asc');

      // Group by retailer
      const retailerData = new Map<string, Array<{ price: number; date: Date }>>();
      
      priceData.forEach(item => {
        if (!retailerData.has(item.retailer_id)) {
          retailerData.set(item.retailer_id, []);
        }
        retailerData.get(item.retailer_id)!.push({
          price: parseFloat(item.price),
          date: new Date(item.recorded_at)
        });
      });

      const trends: PriceTrend[] = [];

      // Analyze trend for each retailer
      retailerData.forEach((prices, retailerId) => {
        if (prices.length < 2) return;

        const firstPrice = prices[0]?.price || 0;
        const lastPrice = prices[prices.length - 1]?.price || 0;
        const changePercentage = ((lastPrice - firstPrice) / firstPrice) * 100;

        let trend: 'increasing' | 'decreasing' | 'stable';
        let confidence = 0;

        if (Math.abs(changePercentage) < 2) {
          trend = 'stable';
          confidence = 0.8;
        } else if (changePercentage > 0) {
          trend = 'increasing';
          confidence = Math.min(0.9, Math.abs(changePercentage) / 20);
        } else {
          trend = 'decreasing';
          confidence = Math.min(0.9, Math.abs(changePercentage) / 20);
        }

        trends.push({
          productId,
          retailerId,
          trend,
          changePercentage,
          timeframe: timeframeDays,
          confidence
        });
      });

      return trends;
    } catch (error) {
      logger.error(`Error analyzing price trends for product ${productId}:`, error);
      throw handleDatabaseError(error);
    }
  }

  /**
   * Get best deals across all products for a user's watchlist
   */
  static async getBestDealsForUser(
    userId: string,
    options: {
      minSavingsPercentage?: number;
      limit?: number;
    } = {}
  ): Promise<(DealAlert & { productName: string; retailerName: string })[]> {
    try {
      const { minSavingsPercentage = 5, limit = 20 } = options;

      // Get user's watched products
      const watchedProducts = await this.db('watches')
        .select('product_id')
        .where('user_id', userId)
        .where('is_active', true);

      if (watchedProducts.length === 0) {
        return [];
      }

      const productIds = watchedProducts.map(w => w.product_id);

      // Get deals for watched products
      const deals = await this.db('product_availability')
        .select(
          'product_availability.*',
          'products.name as product_name',
          'retailers.name as retailer_name'
        )
        .leftJoin('products', 'product_availability.product_id', 'products.id')
        .leftJoin('retailers', 'product_availability.retailer_id', 'retailers.id')
        .whereIn('product_availability.product_id', productIds)
        .where('product_availability.in_stock', true)
        .where('retailers.is_active', true)
        .whereNotNull('product_availability.original_price')
        .whereRaw('product_availability.price < product_availability.original_price')
        .limit(limit * 2);

      const dealAlerts: (DealAlert & { productName: string; retailerName: string })[] = [];

      for (const deal of deals) {
        const savings = parseFloat(deal.original_price) - parseFloat(deal.price);
        const savingsPercentage = (savings / parseFloat(deal.original_price)) * 100;

        if (savingsPercentage < minSavingsPercentage) {
          continue;
        }

        const dealScore = await this.calculateAdvancedDealScore(deal);

        dealAlerts.push({
          id: deal.id,
          productId: deal.product_id,
          retailerId: deal.retailer_id,
          alertType: 'price_drop',
          currentPrice: parseFloat(deal.price),
          previousPrice: parseFloat(deal.original_price),
          savingsAmount: savings,
          savingsPercentage,
          dealScore,
          productName: deal.product_name,
          retailerName: deal.retailer_name
        });

        if (dealAlerts.length >= limit) {
          break;
        }
      }

      return dealAlerts.sort((a, b) => b.dealScore - a.dealScore);
    } catch (error) {
      logger.error(`Error getting best deals for user ${userId}:`, error);
      throw handleDatabaseError(error);
    }
  }
}