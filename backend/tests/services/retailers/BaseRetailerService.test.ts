import { BaseRetailerService } from '../../../src/services/retailers/BaseRetailerService';
import { RetailerConfig, ProductAvailabilityRequest, ProductAvailabilityResponse } from '../../../src/types/retailer';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Create a concrete implementation for testing
class TestRetailerService extends BaseRetailerService {
  async checkAvailability(request: ProductAvailabilityRequest): Promise<ProductAvailabilityResponse> {
    const response = await this.makeRequest('/test', {});
    return this.parseResponse(response.data, request);
  }

  async searchProducts(query: string): Promise<ProductAvailabilityResponse[]> {
    const response = await this.makeRequest('/search', { params: { q: query } });
    return [this.parseResponse(response.data, { productId: 'test' })];
  }

  protected parseResponse(data: any, request: ProductAvailabilityRequest): ProductAvailabilityResponse {
    return {
      productId: request.productId,
      retailerId: this.config.id,
      inStock: data.inStock || false,
      price: data.price || 0,
      availabilityStatus: data.inStock ? 'in_stock' : 'out_of_stock',
      productUrl: data.url || 'https://example.com/product',
      lastUpdated: new Date(),
      metadata: data
    };
  }
}

describe('BaseRetailerService', () => {
  let service: TestRetailerService;
  let mockConfig: RetailerConfig;
  let mockAxiosInstance: any;

  beforeEach(() => {
    mockAxiosInstance = {
      get: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      }
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    mockConfig = {
      id: 'test-retailer',
      name: 'Test Retailer',
      slug: 'test',
      type: 'api',
      baseUrl: 'https://api.test.com',
      apiKey: 'test-api-key',
      rateLimit: {
        requestsPerMinute: 60,
        requestsPerHour: 3600
      },
      timeout: 10000,
      retryConfig: {
        maxRetries: 3,
        retryDelay: 1000
      },
      isActive: true
    };

    service = new TestRetailerService(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create HTTP client with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: mockConfig.baseUrl,
        timeout: mockConfig.timeout,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'BoosterBeacon/1.0'
        }
      });
    });

    it('should setup request and response interceptors', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('rate limiting', () => {
    it('should check rate limits before making requests', () => {
      const rateLimitResult = service['checkRateLimit']();
      expect(typeof rateLimitResult).toBe('boolean');
    });

    it('should calculate minimum request interval correctly', () => {
      const interval = service['calculateMinRequestInterval']();
      expect(interval).toBeGreaterThan(0);
      expect(interval).toBeLessThanOrEqual(60000); // Should be <= 1 minute
    });
  });

  describe('Pokemon TCG product filtering', () => {
    it('should identify Pokemon TCG Booster Pack', () => {
      expect(service['isPokemonTcgProduct']('Pokemon TCG Booster Pack')).toBe(true);
    });

    it('should identify Pokemon Elite Trainer Box', () => {
      expect(service['isPokemonTcgProduct']('Pokemon Elite Trainer Box')).toBe(true);
    });

    it('should identify Pokémon Battle Deck', () => {
      expect(service['isPokemonTcgProduct']('Pokémon Battle Deck')).toBe(true);
    });

    it('should identify Pokemon Trading Card Game Booster', () => {
      expect(service['isPokemonTcgProduct']('Pokemon Trading Card Game Booster')).toBe(true);
    });

    it('should exclude Pokemon Video Game', () => {
      expect(service['isPokemonTcgProduct']('Pokemon Video Game', 'video game')).toBe(false);
    });

    it('should exclude Pokemon Plush Toy', () => {
      expect(service['isPokemonTcgProduct']('Pokemon Plush Toy', 'plush toy')).toBe(false);
    });

    it('should exclude non-Pokemon products', () => {
      expect(service['isPokemonTcgProduct']('Magic The Gathering Cards')).toBe(false);
    });

    it('should use additional text for filtering', () => {
      const result = service['isPokemonTcgProduct']('Card Game', 'Pokemon TCG Booster');
      expect(result).toBe(true);
    });
  });

  describe('utility methods', () => {
    it('should parse prices correctly', () => {
      const testCases = [
        { input: '$29.99', expected: 29.99 },
        { input: '29.99', expected: 29.99 },
        { input: '$29.99 - $39.99', expected: 29.99 },
        { input: 'Member\'s Mark $29.99', expected: 29.99 },
        { input: 'invalid', expected: 0 },
        { input: '', expected: 0 }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = service['parsePrice'](input);
        expect(result).toBe(expected);
      });
    });

    it('should determine availability status correctly', () => {
      expect(service['determineAvailabilityStatus'](false)).toBe('out_of_stock');
      expect(service['determineAvailabilityStatus'](true)).toBe('in_stock');
      expect(service['determineAvailabilityStatus'](true, 'pre-order')).toBe('pre_order');
      expect(service['determineAvailabilityStatus'](true, 'limited stock')).toBe('low_stock');
      expect(service['determineAvailabilityStatus'](true, 'discontinued')).toBe('discontinued');
      expect(service['determineAvailabilityStatus'](true, undefined, 3)).toBe('low_stock');
    });

    it('should build cart URLs correctly', () => {
      expect(service['buildCartUrl']('https://walmart.com/product', 'walmart'))
        .toBe('https://walmart.com/product?athbdg=L1600');
      expect(service['buildCartUrl']('https://bestbuy.com/product', 'bestbuy'))
        .toBeUndefined();
      expect(service['buildCartUrl']('', 'walmart')).toBeUndefined();
    });
  });

  describe('health check', () => {
    it('should perform health check successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: {} });

      // Mock Date.now to ensure response time is measurable
      const originalDateNow = Date.now;
      let callCount = 0;
      Date.now = jest.fn(() => {
        callCount++;
        return originalDateNow() + (callCount * 100); // Add 100ms per call
      });

      const health = await service.getHealthStatus();

      expect(health.retailerId).toBe('test-retailer');
      expect(health.isHealthy).toBe(true);
      expect(health.responseTime).toBeGreaterThan(0);
      expect(health.errors).toHaveLength(0);

      // Restore Date.now
      Date.now = originalDateNow;
    });

    it('should handle health check failures', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      const health = await service.getHealthStatus();

      expect(health.retailerId).toBe('test-retailer');
      expect(health.isHealthy).toBe(false);
      expect(health.errors.length).toBeGreaterThan(0);
    });
  });

  describe('metrics', () => {
    it('should update metrics correctly', () => {
      const initialMetrics = service.getMetrics();
      expect(initialMetrics.totalRequests).toBe(0);

      service['updateMetrics'](true, 100);
      const updatedMetrics = service.getMetrics();
      
      expect(updatedMetrics.totalRequests).toBe(1);
      expect(updatedMetrics.successfulRequests).toBe(1);
      expect(updatedMetrics.averageResponseTime).toBe(100);
    });

    it('should track failed requests', () => {
      service['updateMetrics'](false, 200);
      const metrics = service.getMetrics();
      
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.failedRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(0);
    });
  });

  describe('scraping configuration', () => {
    it('should use different headers for scraping retailers', () => {
      const scrapingConfig = {
        ...mockConfig,
        type: 'scraping' as const
      };

      new TestRetailerService(scrapingConfig);

      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('Mozilla'),
            'Accept': expect.stringContaining('text/html')
          })
        })
      );
    });

    it('should calculate longer intervals for scraping retailers', () => {
      const scrapingConfig = {
        ...mockConfig,
        type: 'scraping' as const
      };

      const scrapingService = new TestRetailerService(scrapingConfig);
      const scrapingInterval = scrapingService['calculateMinRequestInterval']();
      const apiInterval = service['calculateMinRequestInterval']();

      expect(scrapingInterval).toBeGreaterThanOrEqual(2000); // At least 2 seconds
      expect(scrapingInterval).toBeGreaterThanOrEqual(apiInterval);
    });
  });
});