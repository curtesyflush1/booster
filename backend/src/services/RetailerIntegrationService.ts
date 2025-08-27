import { BaseRetailerService, RetailerConfig, ProductAvailabilityRequest, ProductAvailabilityResponse, RetailerHealthStatus, RetailerMetrics, RetailerError } from '../types/retailer';
import { CircuitBreaker, CircuitBreakerConfig } from '../utils/circuitBreaker';
import { BestBuyService } from './retailers/BestBuyService';
import { WalmartService } from './retailers/WalmartService';
import { CostcoService } from './retailers/CostcoService';
import { SamsClubService } from './retailers/SamsClubService';
import { logger } from '../utils/logger';

interface RetailerServiceInstance {
  service: BaseRetailerService;
  circuitBreaker: CircuitBreaker;
  config: RetailerConfig;
}

export class RetailerIntegrationService {
  private retailers: Map<string, RetailerServiceInstance> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.initializeRetailers();
    this.startHealthChecking();
  }

  private initializeRetailers(): void {
    const retailerConfigs = this.getRetailerConfigs();
    
    for (const config of retailerConfigs) {
      try {
        const service = this.createRetailerService(config);
        const circuitBreaker = new CircuitBreaker({
          failureThreshold: 5,
          recoveryTimeout: 60000, // 1 minute
          monitoringPeriod: 300000, // 5 minutes
          successThreshold: 3
        });

        this.retailers.set(config.id, {
          service,
          circuitBreaker,
          config
        });

        logger.info(`Initialized retailer service: ${config.name}`);
      } catch (error) {
        logger.error(`Failed to initialize retailer ${config.name}:`, error);
      }
    }
  }

  private createRetailerService(config: RetailerConfig): BaseRetailerService {
    switch (config.slug) {
      case 'best-buy':
        return new BestBuyService(config);
      case 'walmart':
        return new WalmartService(config);
      case 'costco':
        return new CostcoService(config);
      case 'sams-club':
        return new SamsClubService(config);
      default:
        throw new Error(`Unknown retailer: ${config.slug}`);
    }
  }

  private getRetailerConfigs(): RetailerConfig[] {
    return [
      {
        id: 'best-buy',
        name: 'Best Buy',
        slug: 'best-buy',
        type: 'api',
        baseUrl: 'https://api.bestbuy.com/v1',
        apiKey: process.env.BEST_BUY_API_KEY,
        rateLimit: {
          requestsPerMinute: 5,
          requestsPerHour: 100
        },
        timeout: 10000,
        retryConfig: {
          maxRetries: 3,
          retryDelay: 1000
        },
        isActive: !!process.env.BEST_BUY_API_KEY
      },
      {
        id: 'walmart',
        name: 'Walmart',
        slug: 'walmart',
        type: 'affiliate',
        baseUrl: 'https://api.walmartlabs.com/v1',
        apiKey: process.env.WALMART_API_KEY,
        rateLimit: {
          requestsPerMinute: 5,
          requestsPerHour: 100
        },
        timeout: 10000,
        retryConfig: {
          maxRetries: 3,
          retryDelay: 1000
        },
        isActive: !!process.env.WALMART_API_KEY
      },
      {
        id: 'costco',
        name: 'Costco',
        slug: 'costco',
        type: 'scraping',
        baseUrl: 'https://www.costco.com',
        rateLimit: {
          requestsPerMinute: 2,
          requestsPerHour: 50
        },
        timeout: 15000,
        retryConfig: {
          maxRetries: 2,
          retryDelay: 2000
        },
        isActive: true
      },
      {
        id: 'sams-club',
        name: 'Sam\'s Club',
        slug: 'sams-club',
        type: 'scraping',
        baseUrl: 'https://www.samsclub.com',
        rateLimit: {
          requestsPerMinute: 2,
          requestsPerHour: 50
        },
        timeout: 15000,
        retryConfig: {
          maxRetries: 2,
          retryDelay: 2000
        },
        isActive: true
      }
    ];
  }

  /**
   * Get all retailers with their basic information
   */
  async getAllRetailers(): Promise<Array<{
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    type: string;
    logoUrl?: string;
    website?: string;
    healthStatus?: RetailerHealthStatus;
  }>> {
    const retailers = Array.from(this.retailers.entries()).map(([id, instance]) => ({
      id,
      name: instance.config.name,
      slug: instance.config.slug,
      isActive: instance.config.isActive,
      type: instance.config.type,
      logoUrl: this.getRetailerLogoUrl(instance.config.slug),
      website: this.getRetailerWebsite(instance.config.slug)
    }));

    return retailers;
  }

  private getRetailerLogoUrl(slug: string): string {
    const logoMap: Record<string, string> = {
      'best-buy': '/images/retailers/bestbuy-logo.png',
      'walmart': '/images/retailers/walmart-logo.png',
      'costco': '/images/retailers/costco-logo.png',
      'sams-club': '/images/retailers/samsclub-logo.png'
    };
    return logoMap[slug] || '/images/retailers/default-logo.png';
  }

  private getRetailerWebsite(slug: string): string {
    const websiteMap: Record<string, string> = {
      'best-buy': 'https://www.bestbuy.com',
      'walmart': 'https://www.walmart.com',
      'costco': 'https://www.costco.com',
      'sams-club': 'https://www.samsclub.com'
    };
    return websiteMap[slug] || '';
  }

  /**
   * Check product availability across all active retailers
   */
  async checkProductAvailability(
    request: ProductAvailabilityRequest,
    retailerIds?: string[]
  ): Promise<ProductAvailabilityResponse[]> {
    const targetRetailers = retailerIds || Array.from(this.retailers.keys());
    const results: ProductAvailabilityResponse[] = [];
    const errors: Array<{ retailerId: string; error: unknown }> = [];

    const promises = targetRetailers.map(async (retailerId) => {
      const retailerInstance = this.retailers.get(retailerId);
      if (!retailerInstance || !retailerInstance.config.isActive) {
        return null;
      }

      try {
        const result = await retailerInstance.circuitBreaker.execute(async () => {
          return await retailerInstance.service.checkAvailability(request);
        });
        return result;
      } catch (error) {
        errors.push({ retailerId, error });
        logger.error(`Error checking availability for ${retailerId}:`, error);
        return null;
      }
    });

    const responses = await Promise.allSettled(promises);
    
    responses.forEach((response, index) => {
      if (response.status === 'fulfilled' && response.value) {
        results.push(response.value);
      }
    });

    if (results.length === 0 && errors.length > 0) {
      logger.warn(`No successful availability checks for product ${request.productId}. Errors:`, errors);
    }

    return results;
  }

  /**
   * Search for products across all active retailers
   */
  async searchProducts(
    query: string,
    retailerIds?: string[]
  ): Promise<ProductAvailabilityResponse[]> {
    const targetRetailers = retailerIds || Array.from(this.retailers.keys());
    const results: ProductAvailabilityResponse[] = [];

    const promises = targetRetailers.map(async (retailerId) => {
      const retailerInstance = this.retailers.get(retailerId);
      if (!retailerInstance || !retailerInstance.config.isActive) {
        return [];
      }

      try {
        const result = await retailerInstance.circuitBreaker.execute(async () => {
          return await retailerInstance.service.searchProducts(query);
        });
        return result;
      } catch (error) {
        logger.error(`Error searching products for ${retailerId}:`, error);
        return [];
      }
    });

    const responses = await Promise.allSettled(promises);
    
    responses.forEach((response) => {
      if (response.status === 'fulfilled') {
        results.push(...response.value);
      }
    });

    return results;
  }

  /**
   * Get health status for all retailers
   */
  async getRetailerHealthStatus(): Promise<RetailerHealthStatus[]> {
    const healthStatuses: RetailerHealthStatus[] = [];

    const promises = Array.from(this.retailers.entries()).map(async ([retailerId, instance]) => {
      try {
        const health = await instance.service.getHealthStatus();
        // Update circuit breaker state in health status
        health.circuitBreakerState = instance.circuitBreaker.getState();
        return health;
      } catch (error) {
        logger.error(`Error getting health status for ${retailerId}:`, error);
        return {
          retailerId,
          isHealthy: false,
          responseTime: 0,
          successRate: 0,
          lastChecked: new Date(),
          errors: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
          circuitBreakerState: instance.circuitBreaker.getState()
        };
      }
    });

    const responses = await Promise.allSettled(promises);
    
    responses.forEach((response) => {
      if (response.status === 'fulfilled') {
        healthStatuses.push(response.value);
      }
    });

    return healthStatuses;
  }

  /**
   * Get metrics for all retailers
   */
  getRetailerMetrics(): Array<RetailerMetrics & { circuitBreakerState: string }> {
    const metrics: Array<RetailerMetrics & { circuitBreakerState: string }> = [];

    this.retailers.forEach((instance, retailerId) => {
      const retailerMetrics = instance.service.getMetrics();
      metrics.push({
        ...retailerMetrics,
        circuitBreakerState: instance.circuitBreaker.getState()
      });
    });

    return metrics;
  }

  /**
   * Get configuration for a specific retailer
   */
  getRetailerConfig(retailerId: string): RetailerConfig | null {
    const instance = this.retailers.get(retailerId);
    return instance ? instance.config : null;
  }

  /**
   * Get all retailer configurations
   */
  getAllRetailerConfigs(): RetailerConfig[] {
    return Array.from(this.retailers.values()).map(instance => instance.config);
  }

  /**
   * Enable or disable a retailer
   */
  setRetailerStatus(retailerId: string, isActive: boolean): boolean {
    const instance = this.retailers.get(retailerId);
    if (!instance) {
      return false;
    }

    instance.config.isActive = isActive;
    
    if (isActive) {
      // Reset circuit breaker when re-enabling
      instance.circuitBreaker.reset();
      logger.info(`Enabled retailer: ${instance.config.name}`);
    } else {
      logger.info(`Disabled retailer: ${instance.config.name}`);
    }

    return true;
  }

  /**
   * Reset circuit breaker for a specific retailer
   */
  resetRetailerCircuitBreaker(retailerId: string): boolean {
    const instance = this.retailers.get(retailerId);
    if (!instance) {
      return false;
    }

    instance.circuitBreaker.reset();
    logger.info(`Reset circuit breaker for retailer: ${instance.config.name}`);
    return true;
  }

  /**
   * Get circuit breaker metrics for all retailers
   */
  getCircuitBreakerMetrics(): Array<{ retailerId: string; metrics: any }> {
    const metrics: Array<{ retailerId: string; metrics: any }> = [];

    this.retailers.forEach((instance, retailerId) => {
      metrics.push({
        retailerId,
        metrics: instance.circuitBreaker.getMetrics()
      });
    });

    return metrics;
  }

  /**
   * Start periodic health checking
   */
  private startHealthChecking(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        logger.info('Starting periodic retailer health check');
        const healthStatuses = await this.getRetailerHealthStatus();
        
        // Log unhealthy retailers
        const unhealthyRetailers = healthStatuses.filter(status => !status.isHealthy);
        if (unhealthyRetailers.length > 0) {
          logger.warn(`Unhealthy retailers detected:`, unhealthyRetailers.map(r => ({
            retailerId: r.retailerId,
            errors: r.errors,
            circuitBreakerState: r.circuitBreakerState
          })));
        }

        logger.info(`Health check completed. Healthy: ${healthStatuses.filter(s => s.isHealthy).length}/${healthStatuses.length}`);
      } catch (error) {
        logger.error('Error during periodic health check:', error);
      }
    }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Stop periodic health checking
   */
  stopHealthChecking(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('Stopped periodic health checking');
    }
  }

  /**
   * Shutdown the service and cleanup resources
   */
  shutdown(): void {
    this.stopHealthChecking();
    this.retailers.clear();
    logger.info('Retailer integration service shutdown complete');
  }
}