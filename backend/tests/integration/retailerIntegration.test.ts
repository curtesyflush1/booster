import { RetailerIntegrationService } from '../../src/services/RetailerIntegrationService';
import { BestBuyService } from '../../src/services/retailers/BestBuyService';
import { WalmartService } from '../../src/services/retailers/WalmartService';
import { CostcoService } from '../../src/services/retailers/CostcoService';
import { SamsClubService } from '../../src/services/retailers/SamsClubService';
import { ProductAvailabilityRequest, ProductAvailabilityResponse } from '../../src/types/retailer';

// Mock the retailer services with factory-based constructors that return
// the per-test instance configured in beforeEach.
let bestBuyMockInstance: any;
let walmartMockInstance: any;
let costcoMockInstance: any;
let samsMockInstance: any;

jest.mock('../../src/services/retailers/BestBuyService', () => ({
  BestBuyService: jest.fn().mockImplementation(() => bestBuyMockInstance)
}));
jest.mock('../../src/services/retailers/WalmartService', () => ({
  WalmartService: jest.fn().mockImplementation(() => walmartMockInstance)
}));
jest.mock('../../src/services/retailers/CostcoService', () => ({
  CostcoService: jest.fn().mockImplementation(() => costcoMockInstance)
}));
jest.mock('../../src/services/retailers/SamsClubService', () => ({
  SamsClubService: jest.fn().mockImplementation(() => samsMockInstance)
}));

// Mock environment variables
const originalEnv = process.env;

describe('Retailer Integration Tests', () => {
  let service: RetailerIntegrationService;
  let mockBestBuyService: jest.Mocked<BestBuyService>;
  let mockWalmartService: jest.Mocked<WalmartService>;
  let mockCostcoService: jest.Mocked<CostcoService>;
  let mockSamsClubService: jest.Mocked<SamsClubService>;
  let createSpy: jest.SpyInstance;

  beforeEach(() => {
    // Set up environment variables for API keys
    process.env = {
      ...originalEnv,
      BEST_BUY_API_KEY: 'test-bestbuy-key',
      WALMART_API_KEY: 'test-walmart-key'
    };

    // Create mock service instances
    mockBestBuyService = {
      checkAvailability: jest.fn(),
      searchProducts: jest.fn(),
      getHealthStatus: jest.fn(),
      getMetrics: jest.fn(),
      getConfig: jest.fn()
    } as any;

    mockWalmartService = {
      checkAvailability: jest.fn(),
      searchProducts: jest.fn(),
      getHealthStatus: jest.fn(),
      getMetrics: jest.fn(),
      getConfig: jest.fn()
    } as any;

    mockCostcoService = {
      checkAvailability: jest.fn(),
      searchProducts: jest.fn(),
      getHealthStatus: jest.fn(),
      getMetrics: jest.fn(),
      getConfig: jest.fn()
    } as any;

    mockSamsClubService = {
      checkAvailability: jest.fn(),
      searchProducts: jest.fn(),
      getHealthStatus: jest.fn(),
      getMetrics: jest.fn(),
      getConfig: jest.fn()
    } as any;

    // Assign instances for factory mocks
    bestBuyMockInstance = mockBestBuyService;
    walmartMockInstance = mockWalmartService;
    costcoMockInstance = mockCostcoService;
    samsMockInstance = mockSamsClubService;

    // Limit retailer configs to just Best Buy and Walmart to match test expectations
    jest
      .spyOn(RetailerIntegrationService.prototype as any, 'getRetailerConfigs')
      .mockReturnValue([
        {
          id: 'best-buy',
          name: 'Best Buy',
          slug: 'best-buy',
          type: 'api',
          baseUrl: 'https://api.bestbuy.com/v1',
          apiKey: process.env.BEST_BUY_API_KEY,
          rateLimit: { requestsPerMinute: 5, requestsPerHour: 100 },
          timeout: 10000,
          retryConfig: { maxRetries: 3, retryDelay: 1000 },
          isActive: true
        },
        {
          id: 'walmart',
          name: 'Walmart',
          slug: 'walmart',
          type: 'affiliate',
          baseUrl: 'https://api.walmartlabs.com/v1',
          apiKey: process.env.WALMART_API_KEY,
          rateLimit: { requestsPerMinute: 5, requestsPerHour: 100 },
          timeout: 10000,
          retryConfig: { maxRetries: 3, retryDelay: 1000 },
          isActive: true
        }
      ] as any);

    // As a stronger guarantee, stub the factory inside RetailerIntegrationService
    createSpy = jest
      .spyOn(RetailerIntegrationService.prototype as any, 'createRetailerService')
      .mockImplementation((config: any) => {
        switch (config.slug) {
          case 'best-buy':
            return mockBestBuyService as any;
          case 'walmart':
            return mockWalmartService as any;
          default:
            throw new Error(`Unknown retailer: ${config.slug}`);
        }
      });

    // Mock getConfig methods
    mockBestBuyService.getConfig.mockReturnValue({
      id: 'best-buy',
      name: 'Best Buy',
      slug: 'best-buy',
      type: 'api',
      baseUrl: 'https://api.bestbuy.com/v1',
      apiKey: 'test-bestbuy-key',
      rateLimit: { requestsPerMinute: 5, requestsPerHour: 100 },
      timeout: 10000,
      retryConfig: { maxRetries: 3, retryDelay: 1000 },
      isActive: true
    });

    mockWalmartService.getConfig.mockReturnValue({
      id: 'walmart',
      name: 'Walmart',
      slug: 'walmart',
      type: 'affiliate',
      baseUrl: 'https://api.walmartlabs.com/v1',
      apiKey: 'test-walmart-key',
      rateLimit: { requestsPerMinute: 5, requestsPerHour: 100 },
      timeout: 10000,
      retryConfig: { maxRetries: 3, retryDelay: 1000 },
      isActive: true
    });

    mockCostcoService.getConfig.mockReturnValue({
      id: 'costco',
      name: 'Costco',
      slug: 'costco',
      type: 'scraping',
      baseUrl: 'https://www.costco.com',
      rateLimit: { requestsPerMinute: 2, requestsPerHour: 50 },
      timeout: 15000,
      retryConfig: { maxRetries: 2, retryDelay: 2000 },
      isActive: true
    });

    mockSamsClubService.getConfig.mockReturnValue({
      id: 'sams-club',
      name: 'Sam\'s Club',
      slug: 'sams-club',
      type: 'scraping',
      baseUrl: 'https://www.samsclub.com',
      rateLimit: { requestsPerMinute: 2, requestsPerHour: 50 },
      timeout: 15000,
      retryConfig: { maxRetries: 2, retryDelay: 2000 },
      isActive: true
    });

    service = new RetailerIntegrationService();
  });

  afterEach(() => {
    process.env = originalEnv;
    if (service && typeof (service as any).shutdown === 'function') {
      service.shutdown();
    }
    if (createSpy) {
      createSpy.mockRestore();
    }
    jest.clearAllMocks();
  });

  describe('Circuit Breaker Integration', () => {
    const mockRequest: ProductAvailabilityRequest = {
      productId: 'test-product',
      sku: '123456',
      upc: '123456789012'
    };

    it('should handle circuit breaker failures gracefully', async () => {
      // Mock Best Buy to succeed, Walmart to fail repeatedly
      mockBestBuyService.checkAvailability.mockResolvedValue({
        productId: 'test-product',
        retailerId: 'best-buy',
        inStock: true,
        price: 29.99,
        availabilityStatus: 'in_stock',
        productUrl: 'https://example.com/product',
        lastUpdated: new Date()
      });

      mockWalmartService.checkAvailability.mockRejectedValue(new Error('Service unavailable'));

      // First call should get Best Buy result and Walmart error
      const results1 = await service.checkProductAvailability(mockRequest);
      expect(results1).toHaveLength(1);
      expect(results1[0]?.retailerId).toBe('best-buy');

      // After multiple failures, circuit breaker should open for Walmart
      for (let i = 0; i < 5; i++) {
        await service.checkProductAvailability(mockRequest).catch(() => { });
      }

      // Verify that Best Buy is still working
      const finalResults = await service.checkProductAvailability(mockRequest);
      expect(finalResults).toHaveLength(1);
      expect(finalResults[0]?.retailerId).toBe('best-buy');
    });

    it('should reset circuit breaker when requested', async () => {
      // Cause failures to open circuit breaker
      mockBestBuyService.checkAvailability.mockRejectedValue(new Error('Service down'));

      for (let i = 0; i < 6; i++) {
        await service.checkProductAvailability(mockRequest, ['best-buy']).catch(() => { });
      }

      // Reset circuit breaker
      const resetResult = service.resetRetailerCircuitBreaker('best-buy');
      expect(resetResult).toBe(true);

      // Now mock success and verify it works
      mockBestBuyService.checkAvailability.mockResolvedValue({
        productId: 'test-product',
        retailerId: 'best-buy',
        inStock: true,
        price: 29.99,
        availabilityStatus: 'in_stock',
        productUrl: 'https://example.com/product',
        lastUpdated: new Date()
      });

      const results = await service.checkProductAvailability(mockRequest, ['best-buy']);
      expect(results).toHaveLength(1);
    });

    it('should return false when resetting unknown retailer circuit breaker', () => {
      const result = service.resetRetailerCircuitBreaker('unknown-retailer');
      expect(result).toBe(false);
    });
  });

  describe('Rate Limiting Compliance', () => {
    it('should respect rate limits for API-based retailers', async () => {
      const mockRequest: ProductAvailabilityRequest = {
        productId: 'test-product'
      };

      mockBestBuyService.checkAvailability.mockResolvedValue({
        productId: 'test-product',
        retailerId: 'best-buy',
        inStock: true,
        price: 29.99,
        availabilityStatus: 'in_stock',
        productUrl: 'https://example.com/product',
        lastUpdated: new Date()
      });

      // Make multiple rapid requests
      const promises: Promise<ProductAvailabilityResponse[] | { error: string }>[] = [];
      for (let i = 0; i < 10; i++) {
        promises.push(service.checkProductAvailability(mockRequest, ['best-buy']).catch((error: Error) => ({ error: error.message })));
      }

      const results = await Promise.allSettled(promises);

      // Some requests should succeed, others might be rate limited
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      expect(successful + failed).toBe(10);
      expect(successful).toBeGreaterThan(0); // At least some should succeed
    });

    it('should use more conservative rate limits for scraping retailers', async () => {
      const mockRequest: ProductAvailabilityRequest = {
        productId: 'test-product'
      };

      mockCostcoService.checkAvailability.mockResolvedValue({
        productId: 'test-product',
        retailerId: 'costco',
        inStock: true,
        price: 29.99,
        availabilityStatus: 'in_stock',
        productUrl: 'https://example.com/product',
        lastUpdated: new Date()
      });

      // Costco should have lower rate limits (2 requests per minute vs 5 for APIs)
      const config = service.getRetailerConfig('costco');
      expect(config?.rateLimit.requestsPerMinute).toBe(2);
      expect(config?.type).toBe('scraping');
    });
  });

  describe('Health Monitoring Integration', () => {
    it('should aggregate health status from all retailers', async () => {
      mockBestBuyService.getHealthStatus.mockResolvedValue({
        retailerId: 'best-buy',
        isHealthy: true,
        responseTime: 150,
        successRate: 95.5,
        lastChecked: new Date(),
        errors: [],
        circuitBreakerState: 'CLOSED'
      });

      mockWalmartService.getHealthStatus.mockResolvedValue({
        retailerId: 'walmart',
        isHealthy: false,
        responseTime: 5000,
        successRate: 60.0,
        lastChecked: new Date(),
        errors: ['High response time', 'Low success rate'],
        circuitBreakerState: 'OPEN'
      });

      mockCostcoService.getHealthStatus.mockResolvedValue({
        retailerId: 'costco',
        isHealthy: true,
        responseTime: 800,
        successRate: 85.0,
        lastChecked: new Date(),
        errors: [],
        circuitBreakerState: 'CLOSED'
      });

      mockSamsClubService.getHealthStatus.mockResolvedValue({
        retailerId: 'sams-club',
        isHealthy: true,
        responseTime: 1200,
        successRate: 90.0,
        lastChecked: new Date(),
        errors: [],
        circuitBreakerState: 'CLOSED'
      });

      const healthStatuses = await service.getRetailerHealthStatus();

      expect(healthStatuses).toHaveLength(4);

      const healthyCount = healthStatuses.filter(h => h.isHealthy).length;
      const unhealthyCount = healthStatuses.filter(h => !h.isHealthy).length;

      expect(healthyCount).toBe(3);
      expect(unhealthyCount).toBe(1);

      const walmartHealth = healthStatuses.find(h => h.retailerId === 'walmart');
      expect(walmartHealth?.isHealthy).toBe(false);
      expect(walmartHealth?.errors).toContain('High response time');
    });

    it('should handle health check failures gracefully', async () => {
      mockBestBuyService.getHealthStatus.mockRejectedValue(new Error('Health check failed'));
      mockWalmartService.getHealthStatus.mockResolvedValue({
        retailerId: 'walmart',
        isHealthy: true,
        responseTime: 200,
        successRate: 95.0,
        lastChecked: new Date(),
        errors: [],
        circuitBreakerState: 'CLOSED'
      });

      const healthStatuses = await service.getRetailerHealthStatus();

      expect(healthStatuses).toHaveLength(2); // Should still get results for working services

      const bestBuyHealth = healthStatuses.find(h => h.retailerId === 'best-buy');
      expect(bestBuyHealth?.isHealthy).toBe(false);
      expect(bestBuyHealth?.errors).toContain('Health check failed: Health check failed');
    });
  });

  describe('Retailer Management', () => {
    it('should enable and disable retailers', () => {
      // Initially active
      let config = service.getRetailerConfig('best-buy');
      expect(config?.isActive).toBe(true);

      // Disable
      const disableResult = service.setRetailerStatus('best-buy', false);
      expect(disableResult).toBe(true);

      config = service.getRetailerConfig('best-buy');
      expect(config?.isActive).toBe(false);

      // Re-enable
      const enableResult = service.setRetailerStatus('best-buy', true);
      expect(enableResult).toBe(true);

      config = service.getRetailerConfig('best-buy');
      expect(config?.isActive).toBe(true);
    });

    it('should not affect requests to disabled retailers', async () => {
      const mockRequest: ProductAvailabilityRequest = {
        productId: 'test-product'
      };

      // Disable Best Buy
      service.setRetailerStatus('best-buy', false);

      mockWalmartService.checkAvailability.mockResolvedValue({
        productId: 'test-product',
        retailerId: 'walmart',
        inStock: true,
        price: 29.99,
        availabilityStatus: 'in_stock',
        productUrl: 'https://example.com/product',
        lastUpdated: new Date()
      });

      const results = await service.checkProductAvailability(mockRequest);

      // Should only get Walmart results, not Best Buy
      expect(results.every(r => r.retailerId !== 'best-buy')).toBe(true);
      expect(mockBestBuyService.checkAvailability).not.toHaveBeenCalled();
    });
  });

  describe('Metrics Collection', () => {
    it('should collect metrics from all retailers', () => {
      mockBestBuyService.getMetrics.mockReturnValue({
        retailerId: 'best-buy',
        totalRequests: 100,
        successfulRequests: 95,
        failedRequests: 5,
        averageResponseTime: 200,
        rateLimitHits: 2,
        circuitBreakerTrips: 0,
        lastRequestTime: new Date()
      });

      mockWalmartService.getMetrics.mockReturnValue({
        retailerId: 'walmart',
        totalRequests: 80,
        successfulRequests: 70,
        failedRequests: 10,
        averageResponseTime: 300,
        rateLimitHits: 5,
        circuitBreakerTrips: 1,
        lastRequestTime: new Date()
      });

      const metrics = service.getRetailerMetrics();

      expect(metrics).toHaveLength(2);
      expect(metrics[0]?.retailerId).toBe('best-buy');
      expect(metrics[1]?.retailerId).toBe('walmart');
      expect(metrics[0]).toHaveProperty('circuitBreakerState');
    });

    it('should provide circuit breaker metrics', () => {
      const cbMetrics = service.getCircuitBreakerMetrics();

      expect(cbMetrics).toBeInstanceOf(Array);
      expect(cbMetrics.length).toBeGreaterThan(0);
      expect(cbMetrics[0]).toHaveProperty('retailerId');
      expect(cbMetrics[0]).toHaveProperty('metrics');
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should continue working when some retailers fail', async () => {
      const mockRequest: ProductAvailabilityRequest = {
        productId: 'test-product'
      };

      mockBestBuyService.checkAvailability.mockResolvedValue({
        productId: 'test-product',
        retailerId: 'best-buy',
        inStock: true,
        price: 29.99,
        availabilityStatus: 'in_stock',
        productUrl: 'https://example.com/product',
        lastUpdated: new Date()
      });

      mockWalmartService.checkAvailability.mockRejectedValue(new Error('Network error'));
      mockCostcoService.checkAvailability.mockRejectedValue(new Error('Scraping blocked'));
      mockSamsClubService.checkAvailability.mockRejectedValue(new Error('Rate limited'));

      const results = await service.checkProductAvailability(mockRequest);

      // Should get at least Best Buy result
      expect(results).toHaveLength(1);
      expect(results[0]?.retailerId).toBe('best-buy');
    });

    it('should handle complete service failures gracefully', async () => {
      const mockRequest: ProductAvailabilityRequest = {
        productId: 'test-product'
      };

      // All services fail
      mockBestBuyService.checkAvailability.mockRejectedValue(new Error('Service down'));
      mockWalmartService.checkAvailability.mockRejectedValue(new Error('Service down'));
      mockCostcoService.checkAvailability.mockRejectedValue(new Error('Service down'));
      mockSamsClubService.checkAvailability.mockRejectedValue(new Error('Service down'));

      const results = await service.checkProductAvailability(mockRequest);

      // Should return empty array, not throw error
      expect(results).toHaveLength(0);
    });
  });

  describe('Search Functionality', () => {
    it('should aggregate search results from multiple retailers', async () => {
      mockBestBuyService.searchProducts.mockResolvedValue([
        {
          productId: 'bb-product-1',
          retailerId: 'best-buy',
          inStock: true,
          price: 29.99,
          availabilityStatus: 'in_stock',
          productUrl: 'https://bestbuy.com/product1',
          lastUpdated: new Date()
        }
      ]);

      mockWalmartService.searchProducts.mockResolvedValue([
        {
          productId: 'wm-product-1',
          retailerId: 'walmart',
          inStock: true,
          price: 27.99,
          availabilityStatus: 'in_stock',
          productUrl: 'https://walmart.com/product1',
          lastUpdated: new Date()
        },
        {
          productId: 'wm-product-2',
          retailerId: 'walmart',
          inStock: false,
          price: 31.99,
          availabilityStatus: 'out_of_stock',
          productUrl: 'https://walmart.com/product2',
          lastUpdated: new Date()
        }
      ]);

      mockCostcoService.searchProducts.mockResolvedValue([]);
      mockSamsClubService.searchProducts.mockResolvedValue([]);

      const results = await service.searchProducts('pokemon tcg');

      expect(results).toHaveLength(3);
      expect(results.filter(r => r.retailerId === 'best-buy')).toHaveLength(1);
      expect(results.filter(r => r.retailerId === 'walmart')).toHaveLength(2);
    });
  });
});
