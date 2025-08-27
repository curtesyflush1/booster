import axios from 'axios';
import { WalmartService } from '../../../src/services/retailers/WalmartService';
import { RetailerConfig } from '../../../src/types/retailer';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WalmartService', () => {
  let service: WalmartService;
  let mockAxiosInstance: any;

  const mockConfig: RetailerConfig = {
    id: 'walmart',
    name: 'Walmart',
    slug: 'walmart',
    type: 'affiliate',
    baseUrl: 'https://api.walmartlabs.com/v1',
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
    service = new WalmartService(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw error if API key is missing', () => {
      const configWithoutApiKey = { ...mockConfig, apiKey: undefined };
      expect(() => new WalmartService(configWithoutApiKey)).toThrow('Walmart API key is required');
    });

    it('should create axios instance with correct headers', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: mockConfig.baseUrl,
        timeout: mockConfig.timeout,
        headers: {
          'WM_SVC.NAME': 'Walmart Open API',
          'WM_CONSUMER.ID': 'test-api-key',
          'Accept': 'application/json',
          'User-Agent': 'BoosterBeacon/1.0'
        }
      });
    });
  });

  describe('checkAvailability', () => {
    const mockProduct = {
      itemId: 123456789,
      name: 'Pokemon TCG Booster Pack',
      salePrice: 3.99,
      msrp: 4.99,
      productUrl: 'https://www.walmart.com/ip/pokemon/123456789',
      availabilityStatus: 'Available',
      stock: 'Available',
      imageEntities: [
        {
          thumbnailImage: 'https://i5.walmartimages.com/thumb.jpg',
          mediumImage: 'https://i5.walmartimages.com/medium.jpg',
          largeImage: 'https://i5.walmartimages.com/large.jpg'
        }
      ],
      categoryPath: 'Toys/Trading Cards',
      categoryNode: '4171',
      brandName: 'Pokemon',
      shortDescription: 'Pokemon TCG Booster Pack',
      upc: '123456789012',
      modelNumber: 'PKM-001'
    };

    it('should check availability by UPC successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          items: [mockProduct]
        }
      });

      const result = await service.checkAvailability({
        productId: 'test-product',
        upc: '123456789012'
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/items', {
        params: {
          upc: '123456789012',
          format: 'json'
        }
      });

      expect(result).toEqual({
        productId: 'test-product',
        retailerId: 'walmart',
        inStock: true,
        price: 3.99,
        originalPrice: 4.99,
        availabilityStatus: 'in_stock',
        productUrl: mockProduct.productUrl,
        cartUrl: 'https://www.walmart.com/ip/pokemon/123456789?athbdg=L1600',
        storeLocations: [],
        lastUpdated: expect.any(Date),
        metadata: {
          itemId: mockProduct.itemId,
          name: mockProduct.name,
          upc: mockProduct.upc,
          brandName: mockProduct.brandName,
          categoryPath: mockProduct.categoryPath,
          shortDescription: mockProduct.shortDescription,
          image: mockProduct.imageEntities?.[0]?.mediumImage
        }
      });
    });

    it('should check availability by item ID successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: mockProduct
      });

      const result = await service.checkAvailability({
        productId: '123456789'
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/items/123456789', {
        params: {
          format: 'json'
        }
      });

      expect(result.inStock).toBe(true);
    });

    it('should handle out of stock products', async () => {
      const outOfStockProduct = {
        ...mockProduct,
        availabilityStatus: 'Out of Stock',
        stock: 'Out of Stock'
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: outOfStockProduct
      });

      const result = await service.checkAvailability({
        productId: 'test-product',
        upc: '123456789012'
      });

      expect(result.inStock).toBe(false);
      expect(result.availabilityStatus).toBe('out_of_stock');
    });

    it('should handle limited stock products', async () => {
      const limitedStockProduct = {
        ...mockProduct,
        availabilityStatus: 'Limited Stock'
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: limitedStockProduct
      });

      const result = await service.checkAvailability({
        productId: 'test-product',
        upc: '123456789012'
      });

      expect(result.availabilityStatus).toBe('low_stock');
    });

    it('should handle pre-order products', async () => {
      const preOrderProduct = {
        ...mockProduct,
        availabilityStatus: 'Pre-order'
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: preOrderProduct
      });

      const result = await service.checkAvailability({
        productId: 'test-product',
        upc: '123456789012'
      });

      expect(result.availabilityStatus).toBe('pre_order');
    });

    it('should throw NOT_FOUND error when product is not found', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: { status: 404 }
      });

      await expect(service.checkAvailability({
        productId: 'test-product',
        upc: '999999999999'
      })).rejects.toThrow('Product not found: test-product');
    });
  });

  describe('searchProducts', () => {
    const mockSearchResponse = {
      query: 'pokemon tcg',
      sort: 'relevance',
      responseGroup: 'base',
      totalResults: 2,
      start: 1,
      numItems: 2,
      items: [
        {
          itemId: 123456789,
          name: 'Pokemon TCG Booster Pack',
          salePrice: 3.99,
          msrp: 4.99,
          productUrl: 'https://www.walmart.com/ip/pokemon/123456789',
          availabilityStatus: 'Available',
          stock: 'Available',
          categoryPath: 'Toys/Trading Cards',
          brandName: 'Pokemon'
        },
        {
          itemId: 987654321,
          name: 'Pokemon Video Game', // Should be filtered out
          salePrice: 59.99,
          productUrl: 'https://www.walmart.com/ip/pokemon-game/987654321',
          availabilityStatus: 'Available',
          stock: 'Available',
          categoryPath: 'Electronics/Video Games',
          brandName: 'Nintendo'
        }
      ]
    };

    it('should search and filter Pokemon TCG products', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: mockSearchResponse
      });

      const results = await service.searchProducts('pokemon booster');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/search', {
        params: {
          query: 'pokemon booster pokemon tcg',
          format: 'json',
          categoryId: '4171',
          numItems: 25,
          start: 1
        }
      });

      // Should only return the TCG product, not the video game
      expect(results).toHaveLength(1);
      expect(results[0]?.metadata?.name).toBe('Pokemon TCG Booster Pack');
    });

    it('should return empty array when no products found', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          query: 'nonexistent',
          totalResults: 0,
          items: []
        }
      });

      const results = await service.searchProducts('nonexistent');

      expect(results).toHaveLength(0);
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status when API is responsive', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          query: 'pokemon',
          totalResults: 1,
          items: []
        }
      });

      const health = await service.getHealthStatus();

      expect(health.retailerId).toBe('walmart');
      expect(health.isHealthy).toBe(true);
      expect(health.responseTime).toBeGreaterThan(0);
      expect(health.successRate).toBe(100);
      expect(health.errors).toHaveLength(0);
    });

    it('should return unhealthy status when API fails', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('API Error'));

      const health = await service.getHealthStatus();

      expect(health.retailerId).toBe('walmart');
      expect(health.isHealthy).toBe(false);
      expect(health.errors).toContain('Health check failed: API Error');
    });
  });

  describe('Pokemon TCG product filtering', () => {
    const testCases = [
      {
        name: 'Pokemon TCG Booster Pack',
        categoryPath: 'Toys/Trading Cards',
        brandName: 'Pokemon',
        expected: true
      },
      {
        name: 'Pokemon Elite Trainer Box',
        categoryPath: 'Toys/Games',
        brandName: 'Pokemon',
        expected: true
      },
      {
        name: 'Pokemon Video Game',
        categoryPath: 'Electronics/Video Games',
        brandName: 'Nintendo',
        expected: false
      },
      {
        name: 'Pokemon Plush Toy',
        categoryPath: 'Toys/Plush',
        brandName: 'Pokemon',
        expected: false
      },
      {
        name: 'Pokémon Battle Deck',
        categoryPath: 'Toys/Trading Cards',
        brandName: 'Pokemon',
        expected: true
      },
      {
        name: 'Pokemon Trading Card Game Booster',
        categoryPath: 'Toys/Games',
        brandName: 'Pokemon',
        expected: true
      }
    ];

    testCases.forEach(({ name, categoryPath, brandName, expected }) => {
      it(`should ${expected ? 'include' : 'exclude'} "${name}"`, async () => {
        const mockProduct = {
          itemId: 123456789,
          name,
          salePrice: 4.99,
          productUrl: 'https://www.walmart.com/ip/test/123456789',
          availabilityStatus: 'Available',
          stock: 'Available',
          categoryPath,
          brandName
        };

        mockAxiosInstance.get.mockResolvedValue({
          data: {
            query: 'test',
            totalResults: 1,
            items: [mockProduct]
          }
        });

        const results = await service.searchProducts('test');

        if (expected) {
          expect(results).toHaveLength(1);
          expect(results[0]?.metadata?.name).toBe(name);
        } else {
          expect(results).toHaveLength(0);
        }
      });
    });
  });

  describe('error handling', () => {
    it('should handle rate limit errors', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: { status: 429 }
      });

      await expect(service.checkAvailability({
        productId: 'test-product',
        upc: '123456789012'
      })).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle authentication errors', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: { status: 401 }
      });

      await expect(service.checkAvailability({
        productId: 'test-product',
        upc: '123456789012'
      })).rejects.toThrow('Authentication failed');
    });

    it('should handle network errors', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        code: 'ENOTFOUND'
      });

      await expect(service.checkAvailability({
        productId: 'test-product',
        upc: '123456789012'
      })).rejects.toThrow('Network error');
    });
  });
});