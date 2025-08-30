import axios from 'axios';
import { BestBuyService } from '../../../src/services/retailers/BestBuyService';
import { RetailerConfig } from '../../../src/types/retailer';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('BestBuyService', () => {
  let service: BestBuyService;
  let mockAxiosInstance: any;

  const mockConfig: RetailerConfig = {
    id: 'best-buy',
    name: 'Best Buy',
    slug: 'best-buy',
    type: 'api',
    baseUrl: 'https://api.bestbuy.com/v1',
    apiKey: 'test-api-key',
    rateLimit: {
      requestsPerMinute: 5,
      requestsPerHour: 100
    },
    timeout: 10000,
    retryConfig: {
      maxRetries: 3,
      retryDelay: 1000
    },
    isActive: true
  };

  beforeEach(() => {
    // Create mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
      interceptors: {
        request: {
          use: jest.fn()
        },
        response: {
          use: jest.fn()
        }
      }
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    service = new BestBuyService(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw error if API key is missing', () => {
      const configWithoutApiKey: RetailerConfig = { ...mockConfig, apiKey: undefined };
      expect(() => new BestBuyService(configWithoutApiKey)).toThrow('Best Buy API key is required');
    });

    it('should create axios instance with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: mockConfig.baseUrl,
        timeout: mockConfig.timeout,
        headers: {
          'User-Agent': 'BoosterBeacon/1.0'
        }
      });
    });
  });

  describe('checkAvailability', () => {
    const mockProduct = {
      sku: 123456,
      name: 'Pokemon TCG Booster Pack',
      regularPrice: 4.99,
      salePrice: 3.99,
      onSale: true,
      url: 'https://www.bestbuy.com/site/pokemon/123456.p',
      addToCartUrl: 'https://www.bestbuy.com/cart/add/123456',
      inStoreAvailability: true,
      onlineAvailability: true,
      image: 'https://pisces.bbystatic.com/image.jpg',
      categoryPath: [
        { id: '1', name: 'Toys & Games' },
        { id: '2', name: 'Trading Cards' }
      ]
    };

    it('should check availability by SKU successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: mockProduct
      });

      const result = await service.checkAvailability({
        productId: 'test-product',
        sku: '123456'
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/products/123456', {
        params: {
          apikey: 'test-api-key',
          format: 'json',
          show: 'sku,name,regularPrice,salePrice,onSale,url,addToCartUrl,inStoreAvailability,onlineAvailability,image,categoryPath'
        }
      });

      expect(result).toEqual({
        productId: 'test-product',
        retailerId: 'best-buy',
        inStock: true,
        price: 3.99,
        originalPrice: 4.99,
        availabilityStatus: 'in_stock',
        productUrl: mockProduct.url,
        cartUrl: mockProduct.addToCartUrl,
        storeLocations: [],
        lastUpdated: expect.any(Date),
        metadata: {
          sku: mockProduct.sku,
          name: mockProduct.name,
          onSale: mockProduct.onSale,
          image: mockProduct.image,
          categoryPath: mockProduct.categoryPath
        }
      });
    });

    it('should check availability by UPC successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          products: [mockProduct]
        }
      });

      const result = await service.checkAvailability({
        productId: 'test-product',
        upc: '123456789012'
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/products', {
        params: {
          apikey: 'test-api-key',
          format: 'json',
          upc: '123456789012',
          show: 'sku,name,regularPrice,salePrice,onSale,url,addToCartUrl,inStoreAvailability,onlineAvailability,image,categoryPath',
          pageSize: 1
        }
      });

      expect(result.inStock).toBe(true);
    });

    it('should throw NOT_FOUND error when product is not found', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: { status: 404 }
      });

      await expect(service.checkAvailability({
        productId: 'test-product',
        sku: '999999'
      })).rejects.toThrow('Product not found: test-product');
    });

    it('should handle rate limit errors', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: { status: 429 }
      });

      await expect(service.checkAvailability({
        productId: 'test-product',
        sku: '123456'
      })).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle authentication errors', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: { status: 401 }
      });

      await expect(service.checkAvailability({
        productId: 'test-product',
        sku: '123456'
      })).rejects.toThrow('Authentication failed');
    });

    it('should handle network errors', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        code: 'ECONNABORTED'
      });

      await expect(service.checkAvailability({
        productId: 'test-product',
        sku: '123456'
      })).rejects.toThrow('Network error');
    });
  });

  describe('searchProducts', () => {
    const mockSearchResponse = {
      products: [
        {
          sku: 123456,
          name: 'Pokemon TCG Booster Pack',
          regularPrice: 4.99,
          salePrice: 3.99,
          onSale: true,
          url: 'https://www.bestbuy.com/site/pokemon/123456.p',
          addToCartUrl: 'https://www.bestbuy.com/cart/add/123456',
          inStoreAvailability: true,
          onlineAvailability: true,
          image: 'https://pisces.bbystatic.com/image.jpg',
          categoryPath: [
            { id: '1', name: 'Toys & Games' },
            { id: '2', name: 'Trading Cards' }
          ]
        },
        {
          sku: 789012,
          name: 'Pokemon Video Game', // Should be filtered out
          regularPrice: 59.99,
          onSale: false,
          url: 'https://www.bestbuy.com/site/pokemon/789012.p',
          inStoreAvailability: false,
          onlineAvailability: true,
          image: 'https://pisces.bbystatic.com/image2.jpg',
          categoryPath: [
            { id: '3', name: 'Video Games' }
          ]
        }
      ]
    };

    it('should search and filter Pokemon TCG products', async () => {
      // Override the makeRequest mock for this specific test
      const makeRequestSpy = jest.spyOn(service as any, 'makeRequest');
      makeRequestSpy.mockResolvedValue({
        data: {
          products: mockSearchResponse.products
        }
      });

      // Debug: Check if the filtering method works
      const testProduct = mockSearchResponse.products[0];
      const categoryNames = testProduct.categoryPath.map(cat => cat.name).join(' ');
      const isPokemonTcg = (service as any).isPokemonTcgProduct(testProduct.name, categoryNames);
      console.log('Debug - Product:', testProduct.name);
      console.log('Debug - Category names:', categoryNames);
      console.log('Debug - Is Pokemon TCG:', isPokemonTcg);

      const results = await service.searchProducts('pokemon booster');

      // Should only return the TCG product, not the video game
      expect(results).toHaveLength(1);
      expect(results[0]?.metadata?.name).toBe('Pokemon TCG Booster Pack');
      
      makeRequestSpy.mockRestore();
    });

    it('should return empty array when no products found', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { products: [] }
      });

      const results = await service.searchProducts('nonexistent');

      expect(results).toHaveLength(0);
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status when API is responsive', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { products: [] }
      });

      const health = await service.getHealthStatus();

      expect(health.retailerId).toBe('best-buy');
      expect(health.isHealthy).toBe(true);
      expect(health.responseTime).toBeGreaterThanOrEqual(0);
      expect(health.successRate).toBe(100);
      expect(health.errors).toHaveLength(0);
    });

    it('should return unhealthy status when API fails', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('API Error'));

      const health = await service.getHealthStatus();

      expect(health.retailerId).toBe('best-buy');
      expect(health.isHealthy).toBe(false);
      expect(health.errors).toContain('Health check failed: API Error');
    });
  });

  describe('rate limiting', () => {
    it('should track rate limit state', () => {
      const metrics = service.getMetrics();
      expect(metrics.retailerId).toBe('best-buy');
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.rateLimitHits).toBe(0);
    });
  });

  describe('Pokemon TCG product filtering', () => {
    const testCases = [
      {
        name: 'Pokemon TCG Booster Pack',
        categoryPath: [{ id: '1', name: 'Trading Cards' }],
        expected: true
      },
      {
        name: 'Pokemon Elite Trainer Box',
        categoryPath: [{ id: '1', name: 'Toys & Games' }],
        expected: true
      },
      {
        name: 'Pokemon Video Game',
        categoryPath: [{ id: '1', name: 'Video Games' }],
        expected: false
      },
      {
        name: 'Pokemon Plush Toy',
        categoryPath: [{ id: '1', name: 'Toys & Games' }],
        expected: false
      },
      {
        name: 'Pokémon TCG Battle Deck',
        categoryPath: [{ id: '1', name: 'Trading Cards' }],
        expected: true
      }
    ];

    testCases.forEach(({ name, categoryPath, expected }) => {
      it(`should ${expected ? 'include' : 'exclude'} "${name}"`, async () => {
        const mockProduct = {
          sku: 123456,
          name,
          regularPrice: 4.99,
          onSale: false,
          url: 'https://www.bestbuy.com/site/test.p',
          inStoreAvailability: true,
          onlineAvailability: true,
          image: 'https://test.jpg',
          categoryPath
        };

        // Mock the makeRequest method for this test
        const makeRequestSpy = jest.spyOn(service as any, 'makeRequest');
        makeRequestSpy.mockResolvedValue({
          data: { products: [mockProduct] }
        });

        // Debug: Check if the filtering method works
        const categoryNames = categoryPath.map(cat => cat.name).join(' ');
        const isPokemonTcg = (service as any).isPokemonTcgProduct(name, categoryNames);
        console.log('Debug - Product:', name);
        console.log('Debug - Category names:', categoryNames);
        console.log('Debug - Is Pokemon TCG:', isPokemonTcg);

        const results = await service.searchProducts('test');

        if (expected) {
          expect(results).toHaveLength(1);
          expect(results[0]?.metadata?.name).toBe(name);
        } else {
          expect(results).toHaveLength(0);
        }
        
        makeRequestSpy.mockRestore();
      });
    });
  });
});