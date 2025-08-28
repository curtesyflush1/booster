import { Request, Response } from 'express';
import { MLPredictionService } from '../services/mlPredictionService';
import { DatabaseHelper } from '../utils/dbHelper';
import { logger } from '../utils/logger';
import { successResponse, errorResponse } from '../utils/responseHelpers';

export class MLController {
  
  /**
   * Get price prediction for a product
   * GET /api/ml/products/:productId/price-prediction
   */
  static async getPricePrediction(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const { timeframe = 30 } = req.query;

      if (!productId) {
        errorResponse(res, 400, 'Product ID is required');
        return;
      }

      const timeframeDays = parseInt(timeframe as string, 10);
      if (isNaN(timeframeDays) || timeframeDays < 1 || timeframeDays > 365) {
        errorResponse(res, 400, 'Invalid timeframe. Must be between 1 and 365 days.');
        return;
      }

      const prediction = await MLPredictionService.predictPrice(productId, timeframeDays);
      
      successResponse(res, prediction, 'Price prediction generated successfully');
    } catch (error) {
      logger.error('Error getting price prediction:', error);
      errorResponse(res, 500, 'Failed to generate price prediction');
    }
  }

  /**
   * Get sellout risk assessment for a product
   * GET /api/ml/products/:productId/sellout-risk
   */
  static async getSelloutRisk(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;

      if (!productId) {
        errorResponse(res, 400, 'Product ID is required');
        return;
      }

      const riskAssessment = await MLPredictionService.calculateSelloutRisk(productId);
      
      successResponse(res, riskAssessment, 'Sellout risk assessment generated successfully');
    } catch (error) {
      logger.error('Error getting sellout risk:', error);
      errorResponse(res, 500, 'Failed to generate sellout risk assessment');
    }
  }

  /**
   * Get ROI estimation for a product
   * GET /api/ml/products/:productId/roi-estimate
   */
  static async getROIEstimate(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const { currentPrice, timeframe = 365 } = req.query;

      if (!productId) {
        errorResponse(res, 400, 'Product ID is required');
        return;
      }

      if (!currentPrice) {
        errorResponse(res, 400, 'Current price is required');
        return;
      }

      const price = parseFloat(currentPrice as string);
      const timeframeDays = parseInt(timeframe as string, 10);

      if (isNaN(price) || price <= 0) {
        errorResponse(res, 400, 'Invalid current price');
        return;
      }

      if (isNaN(timeframeDays) || timeframeDays < 1 || timeframeDays > 1825) { // Max 5 years
        errorResponse(res, 400, 'Invalid timeframe. Must be between 1 and 1825 days.');
        return;
      }

      const roiEstimate = await MLPredictionService.estimateROI(productId, price, timeframeDays);
      
      successResponse(res, roiEstimate, 'ROI estimate generated successfully');
    } catch (error) {
      logger.error('Error getting ROI estimate:', error);
      errorResponse(res, 500, 'Failed to generate ROI estimate');
    }
  }

  /**
   * Get hype meter for a product
   * GET /api/ml/products/:productId/hype-meter
   */
  static async getHypeMeter(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;

      if (!productId) {
        errorResponse(res, 400, 'Product ID is required');
        return;
      }

      const hypeMeter = await MLPredictionService.calculateHypeMeter(productId);
      
      successResponse(res, hypeMeter, 'Hype meter calculated successfully');
    } catch (error) {
      logger.error('Error getting hype meter:', error);
      errorResponse(res, 500, 'Failed to calculate hype meter');
    }
  }

  /**
   * Get comprehensive market insights for a product
   * GET /api/ml/products/:productId/market-insights
   */
  static async getMarketInsights(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const { days = 90 } = req.query;

      if (!productId) {
        errorResponse(res, 400, 'Product ID is required');
        return;
      }

      const daysPeriod = parseInt(days as string, 10);
      if (isNaN(daysPeriod) || daysPeriod < 7 || daysPeriod > 365) {
        errorResponse(res, 400, 'Invalid days period. Must be between 7 and 365 days.');
        return;
      }

      const insights = await MLPredictionService.collectHistoricalData(productId, daysPeriod);
      
      successResponse(res, insights, 'Market insights generated successfully');
    } catch (error) {
      logger.error('Error getting market insights:', error);
      errorResponse(res, 500, 'Failed to generate market insights');
    }
  }

  /**
   * Get comprehensive ML analysis for a product (combines all predictions)
   * GET /api/ml/products/:productId/analysis
   */
  static async getComprehensiveAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const { currentPrice, priceTimeframe = 30, roiTimeframe = 365 } = req.query;

      if (!productId) {
        errorResponse(res, 400, 'Product ID is required');
        return;
      }

      // Get all ML predictions in parallel
      const [
        pricePrediction,
        selloutRisk,
        hypeMeter,
        marketInsights
      ] = await Promise.all([
        MLPredictionService.predictPrice(productId, parseInt(priceTimeframe as string, 10) || 30),
        MLPredictionService.calculateSelloutRisk(productId),
        MLPredictionService.calculateHypeMeter(productId),
        MLPredictionService.collectHistoricalData(productId, 90)
      ]);

      // Get ROI estimate if current price is provided
      let roiEstimate = null;
      if (currentPrice) {
        const price = parseFloat(currentPrice as string);
        if (!isNaN(price) && price > 0) {
          roiEstimate = await MLPredictionService.estimateROI(
            productId, 
            price, 
            parseInt(roiTimeframe as string, 10) || 365
          );
        }
      }

      const analysis = {
        productId,
        pricePrediction,
        selloutRisk,
        roiEstimate,
        hypeMeter,
        marketInsights,
        generatedAt: new Date()
      };
      
      successResponse(res, analysis, 'Comprehensive ML analysis generated successfully');
    } catch (error) {
      logger.error('Error getting comprehensive analysis:', error);
      errorResponse(res, 500, 'Failed to generate comprehensive analysis');
    }
  }

  /**
   * Get trending products based on hype metrics
   * GET /api/ml/trending-products
   */
  static async getTrendingProducts(req: Request, res: Response): Promise<void> {
    try {
      const { limit = 10, category } = req.query;

      const limitNum = parseInt(limit as string, 10);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
        errorResponse(res, 400, 'Invalid limit. Must be between 1 and 50.');
        return;
      }

      // Get products with high engagement
      let query = DatabaseHelper.db('products')
        .select('products.*')
        .leftJoin('watches', 'products.id', 'watches.product_id')
        .where('products.is_active', true)
        .groupBy('products.id')
        .orderBy(DatabaseHelper.db.raw('COUNT(watches.id)'), 'desc')
        .limit(limitNum);

      if (category) {
        query = query.where('products.category_id', category as string);
      }

      const products = await query;

      // Get hype metrics for each product
      const trendingProducts = await Promise.all(
        products.map(async (product: any) => {
          const hypeMeter = await MLPredictionService.calculateHypeMeter(product.id);
          return {
            ...product,
            hypeMeter
          };
        })
      );

      // Sort by hype score
      trendingProducts.sort((a, b) => b.hypeMeter.hypeScore - a.hypeMeter.hypeScore);
      
      successResponse(res, trendingProducts, 'Trending products retrieved successfully');
    } catch (error) {
      logger.error('Error getting trending products:', error);
      errorResponse(res, 500, 'Failed to get trending products');
    }
  }

  /**
   * Get products with high sellout risk
   * GET /api/ml/high-risk-products
   */
  static async getHighRiskProducts(req: Request, res: Response): Promise<void> {
    try {
      const { limit = 10, minRiskScore = 50 } = req.query;

      const limitNum = parseInt(limit as string, 10);
      const minRisk = parseInt(minRiskScore as string, 10);

      if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
        errorResponse(res, 400, 'Invalid limit. Must be between 1 and 50.');
        return;
      }

      if (isNaN(minRisk) || minRisk < 0 || minRisk > 100) {
        errorResponse(res, 400, 'Invalid minimum risk score. Must be between 0 and 100.');
        return;
      }

      // Get products with recent availability issues
      const products = await DatabaseHelper.db('products')
        .select('products.*')
        .leftJoin('product_availability', 'products.id', 'product_availability.product_id')
        .where('products.is_active', true)
        .groupBy('products.id')
        .having(DatabaseHelper.db.raw('AVG(CASE WHEN product_availability.in_stock THEN 1 ELSE 0 END)'), '<', 0.5)
        .limit(limitNum * 2); // Get more to filter by risk score

      // Calculate risk for each product and filter
      const highRiskProducts = [];
      for (const product of products) {
        const riskAssessment = await MLPredictionService.calculateSelloutRisk(product.id);
        if (riskAssessment.riskScore >= minRisk) {
          highRiskProducts.push({
            ...product,
            riskAssessment
          });
        }
        if (highRiskProducts.length >= limitNum) break;
      }

      // Sort by risk score
      highRiskProducts.sort((a, b) => b.riskAssessment.riskScore - a.riskAssessment.riskScore);
      
      successResponse(res, highRiskProducts, 'High-risk products retrieved successfully');
    } catch (error) {
      logger.error('Error getting high-risk products:', error);
      errorResponse(res, 500, 'Failed to get high-risk products');
    }
  }
}