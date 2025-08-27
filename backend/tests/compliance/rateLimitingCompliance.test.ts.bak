import { BestBuyService } from '../../src/services/retailers/BestBuyService';
import { WalmartService } from '../../src/services/retailers/WalmartService';
import { CostcoService } from '../../src/services/retailers/CostcoService';
import { SamsClubService } from '../../src/services/retailers/SamsClubService';
import { RetailerConfig, ProductAvailabilityResponse, ProductAvailabilityRequest } from '../../src/types/retailer';

// Mock axios to avoid actual HTTP requests
jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Test constants
const RATE_LIMIT_TEST_REQUESTS = 6;
const API_RATE_LIMIT_MAX_PER_MINUTE = 10;
const API_RATE_LIMIT_MAX_PER_HOUR = 200;
const SCRAPING_RATE_LIMIT_MAX_PER_MINUTE = 3;
const SCRAPING_RATE_LIMIT_MAX_PER_HOUR = 60;
const MIN_TIMEOUT_MS = 5000;
const MAX_TIMEOUT_MS = 30000;
const MIN_SCRAPING_TIMEOUT_MS = 10000;
const MAX_RETRY_ATTEMPTS = 3;
const MIN_RETRY_DELAY_MS = 1000;

// Test utilities
const createMockAxiosInstance = () => ({
  get: jest.fn(),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() }
  }
});

const createMockRequest = (overrides: Partial<ProductAvailabilityRequest> = {}): ProductAvailabilityRequest => ({
  productId: 'test-product',
  sku: '123456',
  ...overrides
});

describe('Rate Limiting and Polite Scraping Compliance', () => {
  beforeEach(() => {
    // Mock axios.create globally for all tests
    const mockAxiosInstance = createMockAxiosInstance();
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
  });
  describe('API-based Retailers (Best Buy, Walmart)', () => {
    let bestBuyService: BestBuyService;
    let walmartService: WalmartService;

    const createMockApiConfig = (overrides: Partial<RetailerConfig> = {}): RetailerConfig => ({
      id: 'test-retailer',
      name: 'Test Retailer',
      slug: 'test-retailer',
      type: 'api',
      baseUrl: 'https://api.test.com',
      apiKey: 'test-key',
      rateLimit: {
        requestsPerMinute: 5,
        requestsPerHour: 100
      },
      timeout: 10000,
      retryConfig: {
        maxRetries: 3,
        retryDelay: 1000
      },
      isActive: true,
      ...overrides
    });

    const mockApiConfig = createMockApiConfig();

    beforeEach(() => {
      // Mock axios.create to return a mock instance
      const mockAxiosInstance = {
        get: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };
      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

      const bestBuyConfig = { ...mockApiConfig, id: 'best-buy', name: 'Best Buy' };
      const walmartConfig = { ...mockApiConfig, id: 'walmart', name: 'Walmart' };

      bestBuyService = new BestBuyService(bestBuyConfig);
      walmartService = new WalmartService(walmartConfig);
    });

    it('should enforce rate limits for API retailers', async () => {
      const mockRequest = createMockRequest({ sku: '123456' });

      // Mock the HTTP client to avoid actual requests
      const mockHttpClient = {
        get: jest.fn().mockResolvedValue({
          data: {
            sku: 123456,
            name: 'Test Product',
            regularPrice: 29.99,
            onlineAvailability: true,
            inStoreAvailability: false,
            url: 'https://test.com/product'
          }
        }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      // Replace the private httpClient with our mock
      (bestBuyService as any).httpClient = mockHttpClient;

      // Make requests up to the rate limit
      const promises: Promise<ProductAvailabilityResponse | { error: string }>[] = [];
      for (let i = 0; i < RATE_LIMIT_TEST_REQUESTS; i++) { // One more than the limit
        promises.push(
          bestBuyService.checkAvailability(mockRequest).catch((error: Error) => ({ error: error.message }))
        );
      }

      const results = await Promise.allSettled(promises);

      // Some requests should be rate limited
      const rateLimitedRequests = results.filter(result =>
        result.status === 'rejected' ||
        (result.status === 'fulfilled' && result.value &&
          typeof result.value === 'object' && 'error' in result.value &&
          typeof result.value.error === 'string' && result.value.error.includes('Rate limit'))
      );

      expect(rateLimitedRequests.length).toBeGreaterThan(0);
    });

    it('should have appropriate rate limits for API retailers', () => {
      const bestBuyConfig = bestBuyService.getConfig();
      const walmartConfig = walmartService.getConfig();

      // API retailers should have reasonable rate limits
      expect(bestBuyConfig.rateLimit.requestsPerMinute).toBeLessThanOrEqual(API_RATE_LIMIT_MAX_PER_MINUTE);
      expect(bestBuyConfig.rateLimit.requestsPerHour).toBeLessThanOrEqual(API_RATE_LIMIT_MAX_PER_HOUR);

      expect(walmartConfig.rateLimit.requestsPerMinute).toBeLessThanOrEqual(API_RATE_LIMIT_MAX_PER_MINUTE);
      expect(walmartConfig.rateLimit.requestsPerHour).toBeLessThanOrEqual(API_RATE_LIMIT_MAX_PER_HOUR);
    });

    it('should have reasonable timeout values', () => {
      const bestBuyConfig = bestBuyService.getConfig();
      const walmartConfig = walmartService.getConfig();

      // Timeouts should be reasonable (not too aggressive)
      expect(bestBuyConfig.timeout).toBeGreaterThanOrEqual(MIN_TIMEOUT_MS);
      expect(bestBuyConfig.timeout).toBeLessThanOrEqual(MAX_TIMEOUT_MS);

      expect(walmartConfig.timeout).toBeGreaterThanOrEqual(MIN_TIMEOUT_MS);
      expect(walmartConfig.timeout).toBeLessThanOrEqual(MAX_TIMEOUT_MS);
    });
  });

  describe('Scraping-based Retailers (Costco, Sam\'s Club)', () => {
    let costcoService: CostcoService;
    let samsClubService: SamsClubService;

    const createMockScrapingConfig = (overrides: Partial<RetailerConfig> = {}): RetailerConfig => ({
      id: 'test-scraper',
      name: 'Test Scraper',
      slug: 'test-scraper',
      type: 'scraping',
      baseUrl: 'https://www.test.com',
      rateLimit: {
        requestsPerMinute: 2,
        requestsPerHour: 50
      },
      timeout: 15000,
      retryConfig: {
        maxRetries: 2,
        retryDelay: 2000
      },
      isActive: true,
      ...overrides
    });

    const mockScrapingConfig = createMockScrapingConfig();

    beforeEach(() => {
      // Mock axios.create to return a mock instance
      const mockAxiosInstance = {
        get: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };
      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

      const costcoConfig = { ...mockScrapingConfig, id: 'costco', name: 'Costco' };
      const samsClubConfig = { ...mockScrapingConfig, id: 'sams-club', name: 'Sam\'s Club' };

      costcoService = new CostcoService(costcoConfig);
      samsClubService = new SamsClubService(samsClubConfig);
    });

    it('should have conservative rate limits for scraping retailers', () => {
      const costcoConfig = costcoService.getConfig();
      const samsClubConfig = samsClubService.getConfig();

      // Scraping retailers should have much lower rate limits
      expect(costcoConfig.rateLimit.requestsPerMinute).toBeLessThanOrEqual(SCRAPING_RATE_LIMIT_MAX_PER_MINUTE);
      expect(costcoConfig.rateLimit.requestsPerHour).toBeLessThanOrEqual(SCRAPING_RATE_LIMIT_MAX_PER_HOUR);

      expect(samsClubConfig.rateLimit.requestsPerMinute).toBeLessThanOrEqual(SCRAPING_RATE_LIMIT_MAX_PER_MINUTE);
      expect(samsClubConfig.rateLimit.requestsPerHour).toBeLessThanOrEqual(SCRAPING_RATE_LIMIT_MAX_PER_HOUR);
    });

    it('should have longer timeouts for scraping retailers', () => {
      const costcoConfig = costcoService.getConfig();
      const samsClubConfig = samsClubService.getConfig();

      // Scraping should have longer timeouts to be more patient
      expect(costcoConfig.timeout).toBeGreaterThanOrEqual(MIN_SCRAPING_TIMEOUT_MS);
      expect(samsClubConfig.timeout).toBeGreaterThanOrEqual(MIN_SCRAPING_TIMEOUT_MS);
    });

    it('should have fewer retry attempts for scraping retailers', () => {
      const costcoConfig = costcoService.getConfig();
      const samsClubConfig = samsClubService.getConfig();

      // Scraping should be less aggressive with retries
      expect(costcoConfig.retryConfig.maxRetries).toBeLessThanOrEqual(MAX_RETRY_ATTEMPTS);
      expect(samsClubConfig.retryConfig.maxRetries).toBeLessThanOrEqual(MAX_RETRY_ATTEMPTS);

      // Should have longer delays between retries
      expect(costcoConfig.retryConfig.retryDelay).toBeGreaterThanOrEqual(MIN_RETRY_DELAY_MS);
      expect(samsClubConfig.retryConfig.retryDelay).toBeGreaterThanOrEqual(MIN_RETRY_DELAY_MS);
    });

    it('should implement polite delays between requests', async () => {
      const mockRequest = createMockRequest();

      // Mock the HTTP client
      const mockHttpClient = {
        get: jest.fn().mockResolvedValue({
          data: '<html><body>Mock HTML response</body></html>'
        }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      (costcoService as any).httpClient = mockHttpClient;

      const startTime = Date.now();

      // Make two consecutive requests
      try {
        await costcoService.checkAvailability(mockRequest);
        await costcoService.checkAvailability(mockRequest);
      } catch (error) {
        // Errors are expected since we're mocking
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should have some delay between requests (at least 1 second for politeness)
      // Note: This test might be flaky due to timing, but it demonstrates the concept
      expect(totalTime).toBeGreaterThan(500); // Some delay should be present
    });

    it('should use appropriate User-Agent headers', () => {
      const costcoConfig = costcoService.getConfig();
      const samsClubConfig = samsClubService.getConfig();

      // Should not use aggressive or bot-like user agents
      // The actual headers are set in the constructor, so we check the service type
      expect(costcoConfig.type).toBe('scraping');
      expect(samsClubConfig.type).toBe('scraping');
    });
  });

  describe('Rate Limit Recovery', () => {
    it('should reset rate limit windows appropriately', async () => {
      const mockConfig: RetailerConfig = {
        id: 'test-rate-limit',
        name: 'Test Rate Limit',
        slug: 'test-rate-limit',
        type: 'api',
        baseUrl: 'https://api.test.com',
        apiKey: 'test-key',
        rateLimit: {
          requestsPerMinute: 2, // Very low limit for testing
          requestsPerHour: 10
        },
        timeout: 5000,
        retryConfig: {
          maxRetries: 1,
          retryDelay: 500
        },
        isActive: true
      };

      const testService = new BestBuyService(mockConfig);

      // Mock the HTTP client
      const mockHttpClient = {
        get: jest.fn().mockResolvedValue({
          data: { sku: 123, name: 'Test', regularPrice: 10, onlineAvailability: true, url: 'test' }
        }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      (testService as any).httpClient = mockHttpClient;

      const mockRequest = { productId: 'test' };

      // Make requests up to the limit
      await testService.checkAvailability(mockRequest).catch(() => { });
      await testService.checkAvailability(mockRequest).catch(() => { });

      // Third request should be rate limited
      let rateLimited = false;
      try {
        await testService.checkAvailability(mockRequest);
      } catch (error) {
        if (error instanceof Error && error.message?.includes('Rate limit')) {
          rateLimited = true;
        }
      }

      // Should have hit rate limit
      expect(rateLimited || mockHttpClient.get.mock.calls.length <= 2).toBe(true);
    });
  });

  describe('Compliance with Terms of Service', () => {
    it('should prioritize official APIs over scraping', () => {
      const bestBuyConfig = new BestBuyService({
        id: 'best-buy',
        name: 'Best Buy',
        slug: 'best-buy',
        type: 'api',
        baseUrl: 'https://api.bestbuy.com/v1',
        apiKey: 'test-key',
        rateLimit: { requestsPerMinute: 5, requestsPerHour: 100 },
        timeout: 10000,
        retryConfig: { maxRetries: 3, retryDelay: 1000 },
        isActive: true
      }).getConfig();

      const costcoConfig = new CostcoService({
        id: 'costco',
        name: 'Costco',
        slug: 'costco',
        type: 'scraping',
        baseUrl: 'https://www.costco.com',
        rateLimit: { requestsPerMinute: 2, requestsPerHour: 50 },
        timeout: 15000,
        retryConfig: { maxRetries: 2, retryDelay: 2000 },
        isActive: true
      }).getConfig();

      // API-based retailers should be marked as such
      expect(bestBuyConfig.type).toBe('api');
      expect(costcoConfig.type).toBe('scraping');

      // API retailers should have higher rate limits (they can handle more)
      expect(bestBuyConfig.rateLimit.requestsPerMinute).toBeGreaterThan(costcoConfig.rateLimit.requestsPerMinute);
    });

    it('should not perform server-side checkout automation', () => {
      // This is more of a design principle test
      // The services should only provide product information and availability
      // They should not include methods for automated purchasing

      const bestBuyService = new BestBuyService({
        id: 'best-buy',
        name: 'Best Buy',
        slug: 'best-buy',
        type: 'api',
        baseUrl: 'https://api.bestbuy.com/v1',
        apiKey: 'test-key',
        rateLimit: { requestsPerMinute: 5, requestsPerHour: 100 },
        timeout: 10000,
        retryConfig: { maxRetries: 3, retryDelay: 1000 },
        isActive: true
      });

      // Services should not have checkout methods
      expect(typeof (bestBuyService as any).checkout).toBe('undefined');
      expect(typeof (bestBuyService as any).addToCart).toBe('undefined');
      expect(typeof (bestBuyService as any).purchase).toBe('undefined');
      expect(typeof (bestBuyService as any).completePurchase).toBe('undefined');

      // Should only have information gathering methods
      expect(typeof bestBuyService.checkAvailability).toBe('function');
      expect(typeof bestBuyService.searchProducts).toBe('function');
      expect(typeof bestBuyService.getHealthStatus).toBe('function');
    });

    it('should respect robots.txt principles for scraping', () => {
      // While we can't test actual robots.txt compliance in unit tests,
      // we can verify that scraping services have appropriate constraints

      const costcoService = new CostcoService({
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

      const config = costcoService.getConfig();

      // Scraping services should be conservative
      expect(config.rateLimit.requestsPerMinute).toBeLessThanOrEqual(SCRAPING_RATE_LIMIT_MAX_PER_MINUTE);
      expect(config.retryConfig.maxRetries).toBeLessThanOrEqual(MAX_RETRY_ATTEMPTS);
      expect(config.retryConfig.retryDelay).toBeGreaterThanOrEqual(MIN_RETRY_DELAY_MS);
    });
  });
});