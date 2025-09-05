import { RetailerIntegrationService } from '../../src/services/RetailerIntegrationService';
import { BestBuyService } from '../../src/services/retailers/BestBuyService';
import { WalmartService } from '../../src/services/retailers/WalmartService';
import { CostcoService } from '../../src/services/retailers/CostcoService';
import { SamsClubService } from '../../src/services/retailers/SamsClubService';

// Mock the retailer services
jest.mock('../../src/services/retailers/BestBuyService');
jest.mock('../../src/services/retailers/WalmartService');
jest.mock('../../src/services/retailers/CostcoService');
jest.mock('../../src/services/retailers/SamsClubService');

// Mock environment variables
const originalEnv = process.env;

describe('RetailerIntegrationService', () => {
  let service: RetailerIntegrationService;
  let mockBestBuyService: jest.Mocked<BestBuyService>;
  let mockWalmartService: jest.Mocked<WalmartService>;
  let mockCostcoService: jest.Mocked<CostcoService>;
  let mockSamsClubService: jest.Mocked<SamsClubService>;

  beforeEach(() => {
    // Set up environment variables
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
      checkAvailability: jest.fn().mockResolvedValue(undefined as any),
      searchProducts: jest.fn().mockResolvedValue([]),
      getHealthStatus: jest.fn().mockResolvedValue({
        retailerId: 'costco', isHealthy: false, responseTime: 0, successRate: 0, lastChecked: new Date(), errors: [], circuitBreakerState: 'CLOSED'
      } as any),
      getMetrics: jest.fn().mockReturnValue({ circuitBreakerState: 'CLOSED' } as any),
      getConfig: jest.fn()
    } as any;

    mockSamsClubService = {
      checkAvailability: jest.fn().mockResolvedValue(undefined as any),
      searchProducts: jest.fn().mockResolvedValue([]),
      getHealthStatus: jest.fn().mockResolvedValue({
        retailerId: 'sams-club', isHealthy: false, responseTime: 0, successRate: 0, lastChecked: new Date(), errors: [], circuitBreakerState: 'CLOSED'
      } as any),
      getMetrics: jest.fn().mockReturnValue({ circuitBreakerState: 'CLOSED' } as any),
      getConfig: jest.fn()
    } as any;

    // Mock constructors
    (BestBuyService as jest.MockedClass<typeof BestBuyService>).mockImplementation(() => mockBestBuyService);
    (WalmartService as jest.MockedClass<typeof WalmartService>).mockImplementation(() => mockWalmartService);
    (CostcoService as jest.MockedClass<typeof CostcoService>).mockImplementation(() => mockCostcoService);
    (SamsClubService as jest.MockedClass<typeof SamsClubService>).mockImplementation(() => mockSamsClubService);

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

    service = new RetailerIntegrationService();
  });

  afterEach(() => {
    process.env = originalEnv;
    service.shutdown();
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize all available retailers', () => {
      expect(BestBuyService).toHaveBeenCalledWith(expect.objectContaining({
        id: 'best-buy',
        name: 'Best Buy',
        apiKey: 'test-bestbuy-key'
      }));

      expect(WalmartService).toHaveBeenCalledWith(expect.objectContaining({
        id: 'walmart',
        name: 'Walmart',
        apiKey: 'test-walmart-key'
      }));

      expect(CostcoService).toHaveBeenCalledWith(expect.objectContaining({
        id: 'costco',
        name: 'Costco'
      }));

      expect(SamsClubService).toHaveBeenCalledWith(expect.objectContaining({
        id: 'sams-club',
        name: 'Sam\'s Club'
      }));
    });

    it('should not initialize retailers without API keys', () => {
      process.env.BEST_BUY_API_KEY = '';
      process.env.WALMART_API_KEY = '';

      const newService = new RetailerIntegrationService();
      
      // Should still initialize scraping services (Costco, Sam's Club)
      expect(CostcoService).toHaveBeenCalled();
      expect(SamsClubService).toHaveBeenCalled();
      
      newService.shutdown();
    });
  });

  describe('checkProductAvailability', () => {
    const mockRequest = {
      productId: 'test-product',
      sku: '123456',
      upc: '123456789012'
    };

    const mockResponse = {
      productId: 'test-product',
      retailerId: 'best-buy',
      inStock: true,
      price: 29.99,
      availabilityStatus: 'in_stock' as const,
      productUrl: 'https://example.com/product',
      lastUpdated: new Date()
    };

    it('should check availability across all active retailers', async () => {
      mockBestBuyService.checkAvailability.mockResolvedValue(mockResponse);
      mockWalmartService.checkAvailability.mockResolvedValue({
        ...mockResponse,
        retailerId: 'walmart'
      });

      const results = await service.checkProductAvailability(mockRequest);

      expect(mockBestBuyService.checkAvailability).toHaveBeenCalledWith(mockRequest);
      expect(mockWalmartService.checkAvailability).toHaveBeenCalledWith(mockRequest);
      expect(results).toHaveLength(2);
      expect(results[0]?.retailerId).toBe('best-buy');
      expect(results[1]?.retailerId).toBe('walmart');
    });

    it('should check availability for specific retailers only', async () => {
      mockBestBuyService.checkAvailability.mockResolvedValue(mockResponse);

      const results = await service.checkProductAvailability(mockRequest, ['best-buy']);

      expect(mockBestBuyService.checkAvailability).toHaveBeenCalledWith(mockRequest);
      expect(mockWalmartService.checkAvailability).not.toHaveBeenCalled();
      expect(results).toHaveLength(1);
      expect(results[0]?.retailerId).toBe('best-buy');
    });

    it('should handle retailer errors gracefully', async () => {
      mockBestBuyService.checkAvailability.mockResolvedValue(mockResponse);
      mockWalmartService.checkAvailability.mockRejectedValue(new Error('API Error'));

      const results = await service.checkProductAvailability(mockRequest);

      expect(results).toHaveLength(1);
      expect(results[0]?.retailerId).toBe('best-buy');
    });

    it('should return empty array when all retailers fail', async () => {
      mockBestBuyService.checkAvailability.mockRejectedValue(new Error('API Error'));
      mockWalmartService.checkAvailability.mockRejectedValue(new Error('API Error'));

      const results = await service.checkProductAvailability(mockRequest);

      expect(results).toHaveLength(0);
    });
  });

  describe('searchProducts', () => {
    const mockSearchResults = [
      {
        productId: 'product-1',
        retailerId: 'best-buy',
        inStock: true,
        price: 29.99,
        availabilityStatus: 'in_stock' as const,
        productUrl: 'https://example.com/product1',
        lastUpdated: new Date()
      },
      {
        productId: 'product-2',
        retailerId: 'best-buy',
        inStock: false,
        price: 34.99,
        availabilityStatus: 'out_of_stock' as const,
        productUrl: 'https://example.com/product2',
        lastUpdated: new Date()
      }
    ];

    it('should search products across active retailers (includes scraping retailers)', async () => {
      mockBestBuyService.searchProducts.mockResolvedValue(mockSearchResults);
      mockWalmartService.searchProducts.mockResolvedValue([]);

      const results = await service.searchProducts('pokemon booster');

      expect(mockBestBuyService.searchProducts).toHaveBeenCalledWith('pokemon booster');
      expect(mockWalmartService.searchProducts).toHaveBeenCalledWith('pokemon booster');
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.some(r => r?.retailerId === 'best-buy')).toBe(true);
    });

    it('should search products for specific retailers only', async () => {
      mockBestBuyService.searchProducts.mockResolvedValue(mockSearchResults);

      const results = await service.searchProducts('pokemon booster', ['best-buy']);

      expect(mockBestBuyService.searchProducts).toHaveBeenCalledWith('pokemon booster');
      expect(mockWalmartService.searchProducts).not.toHaveBeenCalled();
      expect(results).toHaveLength(2);
    });

    it('should handle search errors gracefully', async () => {
      mockBestBuyService.searchProducts.mockResolvedValue(mockSearchResults);
      mockWalmartService.searchProducts.mockRejectedValue(new Error('Search Error'));

      const results = await service.searchProducts('pokemon booster');

      expect(results).toHaveLength(2);
      expect(results.every(r => r.retailerId === 'best-buy')).toBe(true);
    });
  });

  describe('getRetailerHealthStatus', () => {
    const mockHealthStatus = {
      retailerId: 'best-buy',
      isHealthy: true,
      responseTime: 150,
      successRate: 95.5,
      lastChecked: new Date(),
      errors: [],
      circuitBreakerState: 'CLOSED' as const
    };

    it('should get health status for all retailers', async () => {
      mockBestBuyService.getHealthStatus.mockResolvedValue(mockHealthStatus);
      mockWalmartService.getHealthStatus.mockResolvedValue({
        ...mockHealthStatus,
        retailerId: 'walmart'
      });

      const results = await service.getRetailerHealthStatus();

      expect(mockBestBuyService.getHealthStatus).toHaveBeenCalled();
      expect(mockWalmartService.getHealthStatus).toHaveBeenCalled();
      expect(results.length).toBeGreaterThanOrEqual(2);
      const ids = results.map(r => r?.retailerId);
      expect(ids).toContain('best-buy');
      expect(ids).toContain('walmart');
    });

    it('should handle health check errors', async () => {
      mockBestBuyService.getHealthStatus.mockResolvedValue(mockHealthStatus);
      mockWalmartService.getHealthStatus.mockRejectedValue(new Error('Health Check Error'));

      const results = await service.getRetailerHealthStatus();

      expect(results.length).toBeGreaterThanOrEqual(2);
      const wm = results.find(r => r?.retailerId === 'walmart');
      expect(wm?.isHealthy).toBe(false);
      expect(wm?.errors).toContain('Health check failed: Health Check Error');
    });
  });

  describe('getRetailerMetrics', () => {
    const mockMetrics = {
      retailerId: 'best-buy',
      totalRequests: 100,
      successfulRequests: 95,
      failedRequests: 5,
      averageResponseTime: 200,
      rateLimitHits: 2,
      circuitBreakerTrips: 0,
      lastRequestTime: new Date()
    };

    it('should get metrics for retailers', () => {
      mockBestBuyService.getMetrics.mockReturnValue(mockMetrics);
      mockWalmartService.getMetrics.mockReturnValue({
        ...mockMetrics,
        retailerId: 'walmart'
      });

      const results = service.getRetailerMetrics();

      expect(results.length).toBeGreaterThanOrEqual(2);
      const ids = results.map(r => r?.retailerId);
      expect(ids).toContain('best-buy');
      expect(ids).toContain('walmart');
      expect(results[0]).toHaveProperty('circuitBreakerState');
    });
  });

  describe('retailer management', () => {
    it('should enable/disable retailers', () => {
      const result = service.setRetailerStatus('best-buy', false);
      expect(result).toBe(true);

      const config = service.getRetailerConfig('best-buy');
      expect(config?.isActive).toBe(false);
    });

    it('should return false for unknown retailer', () => {
      const result = service.setRetailerStatus('unknown-retailer', false);
      expect(result).toBe(false);
    });

    it('should reset circuit breaker', () => {
      const result = service.resetRetailerCircuitBreaker('best-buy');
      expect(result).toBe(true);
    });

    it('should return false when resetting unknown retailer circuit breaker', () => {
      const result = service.resetRetailerCircuitBreaker('unknown-retailer');
      expect(result).toBe(false);
    });
  });

  describe('configuration management', () => {
    it('should get retailer configuration', () => {
      const config = service.getRetailerConfig('best-buy');
      expect(config).toBeDefined();
      expect(config?.id).toBe('best-buy');
      expect(config?.name).toBe('Best Buy');
    });

    it('should return null for unknown retailer', () => {
      const config = service.getRetailerConfig('unknown-retailer');
      expect(config).toBeNull();
    });

    it('should get all retailer configurations', () => {
      const configs = service.getAllRetailerConfigs();
      expect(configs.length).toBeGreaterThan(0);
      expect(configs.some(c => c.id === 'best-buy')).toBe(true);
      expect(configs.some(c => c.id === 'walmart')).toBe(true);
    });
  });

  describe('circuit breaker integration', () => {
    it('should get circuit breaker metrics', () => {
      const metrics = service.getCircuitBreakerMetrics();
      expect(metrics).toBeInstanceOf(Array);
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[0]).toHaveProperty('retailerId');
      expect(metrics[0]).toHaveProperty('metrics');
    });
  });

  describe('shutdown', () => {
    it('should cleanup resources on shutdown', () => {
      service.shutdown();
      // Verify that health checking is stopped
      expect(service['healthCheckInterval']).toBeNull();
    });
  });
});
