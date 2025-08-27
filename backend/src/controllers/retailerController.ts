import { Request, Response } from 'express';
import { RetailerIntegrationService } from '../services/RetailerIntegrationService';
import { ProductAvailabilityRequest } from '../types/retailer';
import { logger } from '../utils/logger';
import { successResponse, errorResponse } from '../utils/responseHelpers';

export class RetailerController {
  private retailerService: RetailerIntegrationService;

  constructor() {
    this.retailerService = new RetailerIntegrationService();
  }

  /**
   * Get all retailers
   * GET /api/retailers
   */
  getAllRetailers = async (req: Request, res: Response): Promise<void> => {
    try {
      logger.info('Fetching all retailers');

      const retailers = await this.retailerService.getAllRetailers();

      successResponse(res, retailers);

    } catch (error) {
      logger.error('Error fetching retailers:', error);
      errorResponse(res, 500, 'Failed to fetch retailers');
    }
  };

  /**
   * Check product availability across retailers
   * GET /api/retailers/availability/:productId
   */
  checkAvailability = async (req: Request, res: Response): Promise<void> => {
    try {
      const { productId } = req.params;
      const { sku, upc, zipCode, radiusMiles, retailers } = req.query;

      const request: ProductAvailabilityRequest = {
        productId: productId!,
        sku: sku as string | undefined,
        upc: upc as string | undefined,
        zipCode: zipCode as string | undefined,
        radiusMiles: radiusMiles ? parseInt(radiusMiles as string) : undefined
      };

      const retailerIds = retailers ? (retailers as string).split(',') : undefined;

      logger.info(`Checking availability for product ${productId} across retailers:`, retailerIds || 'all');

      const results = await this.retailerService.checkProductAvailability(request, retailerIds);

      successResponse(res, {
        productId,
        retailers: results,
        totalRetailers: results.length,
        inStockRetailers: results.filter(r => r.inStock).length
      });

    } catch (error) {
      logger.error('Error checking product availability:', error);
      errorResponse(res, 500, 'Failed to check product availability');
    }
  };

  /**
   * Search products across retailers
   * GET /api/retailers/search
   */
  searchProducts = async (req: Request, res: Response): Promise<void> => {
    try {
      const { q: query, retailers } = req.query;

      if (!query) {
        errorResponse(res, 400, 'Search query is required');
        return;
      }

      const retailerIds = retailers ? (retailers as string).split(',') : undefined;

      logger.info(`Searching products for query "${query}" across retailers:`, retailerIds || 'all');

      const results = await this.retailerService.searchProducts(query as string, retailerIds);

      // Group results by retailer
      const groupedResults = results.reduce((acc, result) => {
        if (!acc[result.retailerId]) {
          acc[result.retailerId] = [];
        }
        acc[result.retailerId]!.push(result);
        return acc;
      }, {} as Record<string, typeof results>);

      successResponse(res, {
        query,
        totalResults: results.length,
        retailers: groupedResults,
        summary: {
          totalProducts: results.length,
          inStockProducts: results.filter(r => r.inStock).length,
          retailersWithResults: Object.keys(groupedResults).length
        }
      });

    } catch (error) {
      logger.error('Error searching products:', error);
      errorResponse(res, 500, 'Failed to search products');
    }
  };

  /**
   * Get retailer health status
   * GET /api/retailers/health
   */
  getHealthStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      logger.info('Getting retailer health status');

      const healthStatuses = await this.retailerService.getRetailerHealthStatus();

      const summary = {
        totalRetailers: healthStatuses.length,
        healthyRetailers: healthStatuses.filter(h => h.isHealthy).length,
        unhealthyRetailers: healthStatuses.filter(h => !h.isHealthy).length,
        averageResponseTime: healthStatuses.reduce((sum, h) => sum + h.responseTime, 0) / healthStatuses.length,
        averageSuccessRate: healthStatuses.reduce((sum, h) => sum + h.successRate, 0) / healthStatuses.length
      };

      successResponse(res, {
        summary,
        retailers: healthStatuses
      });

    } catch (error) {
      logger.error('Error getting retailer health status:', error);
      errorResponse(res, 500, 'Failed to get retailer health status');
    }
  };

  /**
   * Get retailer metrics
   * GET /api/retailers/metrics
   */
  getMetrics = async (req: Request, res: Response): Promise<void> => {
    try {
      logger.info('Getting retailer metrics');

      const metrics = this.retailerService.getRetailerMetrics();
      const circuitBreakerMetrics = this.retailerService.getCircuitBreakerMetrics();

      const summary = {
        totalRequests: metrics.reduce((sum, m) => sum + m.totalRequests, 0),
        totalSuccessfulRequests: metrics.reduce((sum, m) => sum + m.successfulRequests, 0),
        totalFailedRequests: metrics.reduce((sum, m) => sum + m.failedRequests, 0),
        averageResponseTime: metrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / metrics.length,
        totalRateLimitHits: metrics.reduce((sum, m) => sum + m.rateLimitHits, 0),
        totalCircuitBreakerTrips: metrics.reduce((sum, m) => sum + m.circuitBreakerTrips, 0)
      };

      successResponse(res, {
        summary,
        retailers: metrics,
        circuitBreakers: circuitBreakerMetrics
      });

    } catch (error) {
      logger.error('Error getting retailer metrics:', error);
      errorResponse(res, 500, 'Failed to get retailer metrics');
    }
  };

  /**
   * Get retailer configurations
   * GET /api/retailers/config
   */
  getConfigurations = async (req: Request, res: Response): Promise<void> => {
    try {
      const configs = this.retailerService.getAllRetailerConfigs();

      // Remove sensitive information like API keys
      const sanitizedConfigs = configs.map(config => ({
        id: config.id,
        name: config.name,
        slug: config.slug,
        type: config.type,
        baseUrl: config.baseUrl,
        rateLimit: config.rateLimit,
        timeout: config.timeout,
        retryConfig: config.retryConfig,
        isActive: config.isActive,
        hasApiKey: !!config.apiKey
      }));

      successResponse(res, {
        retailers: sanitizedConfigs
      });

    } catch (error) {
      logger.error('Error getting retailer configurations:', error);
      errorResponse(res, 500, 'Failed to get retailer configurations');
    }
  };

  /**
   * Enable or disable a retailer
   * PUT /api/retailers/:retailerId/status
   */
  setRetailerStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { retailerId } = req.params;
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        errorResponse(res, 400, 'isActive must be a boolean');
        return;
      }

      const success = this.retailerService.setRetailerStatus(retailerId!, isActive);

      if (!success) {
        errorResponse(res, 404, 'Retailer not found');
        return;
      }

      logger.info(`${isActive ? 'Enabled' : 'Disabled'} retailer: ${retailerId}`);

      successResponse(res, {
        retailerId,
        isActive,
        message: `Retailer ${isActive ? 'enabled' : 'disabled'} successfully`
      });

    } catch (error) {
      logger.error('Error setting retailer status:', error);
      errorResponse(res, 500, 'Failed to set retailer status');
    }
  };

  /**
   * Reset circuit breaker for a retailer
   * POST /api/retailers/:retailerId/circuit-breaker/reset
   */
  resetCircuitBreaker = async (req: Request, res: Response): Promise<void> => {
    try {
      const { retailerId } = req.params;

      const success = this.retailerService.resetRetailerCircuitBreaker(retailerId!);

      if (!success) {
        errorResponse(res, 404, 'Retailer not found');
        return;
      }

      logger.info(`Reset circuit breaker for retailer: ${retailerId}`);

      successResponse(res, {
        retailerId,
        message: 'Circuit breaker reset successfully'
      });

    } catch (error) {
      logger.error('Error resetting circuit breaker:', error);
      errorResponse(res, 500, 'Failed to reset circuit breaker');
    }
  };

  /**
   * Get specific retailer configuration
   * GET /api/retailers/:retailerId/config
   */
  getRetailerConfig = async (req: Request, res: Response): Promise<void> => {
    try {
      const { retailerId } = req.params;

      const config = this.retailerService.getRetailerConfig(retailerId!);

      if (!config) {
        errorResponse(res, 404, 'Retailer not found');
        return;
      }

      // Remove sensitive information
      const sanitizedConfig = {
        id: config.id,
        name: config.name,
        slug: config.slug,
        type: config.type,
        baseUrl: config.baseUrl,
        rateLimit: config.rateLimit,
        timeout: config.timeout,
        retryConfig: config.retryConfig,
        isActive: config.isActive,
        hasApiKey: !!config.apiKey
      };

      successResponse(res, sanitizedConfig);

    } catch (error) {
      logger.error('Error getting retailer configuration:', error);
      errorResponse(res, 500, 'Failed to get retailer configuration');
    }
  };

  /**
   * Cleanup method for graceful shutdown
   */
  shutdown(): void {
    this.retailerService.shutdown();
  }
}