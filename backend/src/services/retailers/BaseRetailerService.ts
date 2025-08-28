import axios, { AxiosInstance, AxiosResponse, AxiosRequestConfig } from 'axios';
import { BaseRetailerService as IBaseRetailerService, RetailerConfig, ProductAvailabilityRequest, ProductAvailabilityResponse, RetailerHealthStatus, StoreLocation, RetailerError } from '../../types/retailer';
import { logger } from '../../utils/logger';
import { RETAILER_RATE_LIMITS } from '../../constants';

/**
 * Enhanced BaseRetailerService implementation that provides common functionality
 * for all retailer integrations, reducing code duplication and standardizing behavior.
 */
export abstract class BaseRetailerService extends IBaseRetailerService {
  protected httpClient: AxiosInstance;
  protected lastRequestTime: number = 0;
  protected readonly minRequestInterval: number;

  constructor(config: RetailerConfig) {
    super(config);
    
    // Set minimum request interval based on retailer type
    this.minRequestInterval = this.calculateMinRequestInterval();
    
    // Initialize HTTP client with common configuration
    this.httpClient = this.createHttpClient();
    
    // Setup common interceptors
    this.setupRequestInterceptors();
    this.setupResponseInterceptors();
  }

  /**
   * Calculate minimum request interval based on retailer type and rate limits
   */
  protected calculateMinRequestInterval(): number {
    const baseInterval = RETAILER_RATE_LIMITS.BASE_REQUEST_INTERVAL / this.config.rateLimit.requestsPerMinute;
    
    // Add extra delay for scraping-based retailers to be more polite
    if (this.config.type === 'scraping') {
      return Math.max(baseInterval, RETAILER_RATE_LIMITS.SCRAPING_MIN_INTERVAL);
    }
    
    return baseInterval;
  }

  /**
   * Create and configure the HTTP client with common settings
   */
  protected createHttpClient(): AxiosInstance {
    const defaultHeaders: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'BoosterBeacon/1.0',
    };

    // Add scraping-specific headers for web scraping retailers
    if (this.config.type === 'scraping') {
      Object.assign(defaultHeaders, {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      });
    }

    return axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        ...defaultHeaders,
        ...this.config.headers
      }
    });
  }

  /**
   * Setup common request interceptors for rate limiting and polite delays
   */
  protected setupRequestInterceptors(): void {
    this.httpClient.interceptors.request.use(async (config) => {
      // Check rate limiting
      if (!this.checkRateLimit()) {
        throw this.createRetailerError(
          'Rate limit exceeded',
          'RATE_LIMIT',
          429,
          true
        );
      }

      // Implement polite delay between requests
      await this.enforcePoliteDelay();

      // Add retailer-specific authentication if needed
      this.addAuthenticationHeaders(config);

      return config;
    });
  }

  /**
   * Setup common response interceptors for error handling
   */
  protected setupResponseInterceptors(): void {
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error) => {
        // Handle common HTTP errors
        if (error.response?.status === 429) {
          throw this.createRetailerError(
            'Rate limit exceeded',
            'RATE_LIMIT',
            429,
            true
          );
        }
        
        if (error.response?.status === 401 || error.response?.status === 403) {
          const message = this.config.type === 'scraping' 
            ? 'Access forbidden - possible bot detection'
            : 'Authentication failed';
          throw this.createRetailerError(
            message,
            'AUTH',
            error.response.status,
            false
          );
        }
        
        if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND') {
          throw this.createRetailerError(
            'Network error',
            'NETWORK',
            undefined,
            true
          );
        }
        
        throw error;
      }
    );
  }

  /**
   * Enforce polite delay between requests, especially for scraping
   */
  protected async enforcePoliteDelay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const delay = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Add authentication headers based on retailer configuration
   */
  protected addAuthenticationHeaders(config: AxiosRequestConfig): void {
    if (this.config.apiKey) {
      // Different retailers use different authentication methods
      switch (this.config.id) {
        case 'bestbuy':
          if (config.params) {
            config.params.apikey = this.config.apiKey;
          } else {
            config.params = { apikey: this.config.apiKey };
          }
          break;
        case 'walmart':
          if (config.headers) {
            config.headers['WM_SVC.NAME'] = 'Walmart Open API';
            config.headers['WM_CONSUMER.ID'] = this.config.apiKey;
          }
          break;
        default:
          // Generic API key header
          if (config.headers) {
            config.headers['Authorization'] = `Bearer ${this.config.apiKey}`;
          }
          break;
      }
    }
  }

  /**
   * Common implementation for making HTTP requests with error handling
   */
  protected async makeRequest(url: string, options: any = {}): Promise<AxiosResponse> {
    try {
      return await this.httpClient.get(url, options);
    } catch (error) {
      // Log the error for debugging
      logger.error(`HTTP request failed for ${this.config.id}:`, {
        url,
        error: error instanceof Error ? error.message : 'Unknown error',
        retailerId: this.config.id
      });
      throw error;
    }
  }

  /**
   * Common health check implementation
   */
  async getHealthStatus(): Promise<RetailerHealthStatus> {
    const startTime = Date.now();
    const errors: string[] = [];
    let isHealthy = true;

    try {
      // Perform a simple health check request
      await this.performHealthCheck();
      
      const responseTime = Date.now() - startTime;
      const successRate = this.calculateSuccessRate();

      // Determine health thresholds based on retailer type
      const { successThreshold, responseTimeThreshold } = this.getHealthThresholds();

      if (successRate < successThreshold) {
        isHealthy = false;
        errors.push(`Low success rate: ${successRate.toFixed(1)}%`);
      }
      
      if (responseTime > responseTimeThreshold) {
        isHealthy = false;
        errors.push(`High response time: ${responseTime}ms`);
      }

      return {
        retailerId: this.config.id,
        isHealthy,
        responseTime,
        successRate,
        lastChecked: new Date(),
        errors,
        circuitBreakerState: 'CLOSED'
      };
      
    } catch (error) {
      errors.push(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        retailerId: this.config.id,
        isHealthy: false,
        responseTime: Date.now() - startTime,
        successRate: this.calculateSuccessRate(),
        lastChecked: new Date(),
        errors,
        circuitBreakerState: 'OPEN'
      };
    }
  }

  /**
   * Perform retailer-specific health check - can be overridden by subclasses
   */
  protected async performHealthCheck(): Promise<void> {
    // Default implementation - simple request to base URL or search endpoint
    if (this.config.type === 'api') {
      await this.makeRequest('/search', {
        params: { q: 'test', limit: 1 }
      });
    } else {
      await this.makeRequest('/', {});
    }
  }

  /**
   * Calculate current success rate
   */
  protected calculateSuccessRate(): number {
    return this.metrics.totalRequests > 0 
      ? (this.metrics.successfulRequests / this.metrics.totalRequests) * 100 
      : 100;
  }

  /**
   * Get health check thresholds based on retailer type
   */
  protected getHealthThresholds(): { successThreshold: number; responseTimeThreshold: number } {
    if (this.config.type === 'scraping') {
      return {
        successThreshold: 80, // Lower threshold for scraping
        responseTimeThreshold: 10000 // 10 seconds for scraping
      };
    }
    
    return {
      successThreshold: 90, // Higher threshold for APIs
      responseTimeThreshold: 5000 // 5 seconds for APIs
    };
  }

  /**
   * Common utility to check if a product is Pokemon TCG related
   */
  protected isPokemonTcgProduct(name: string, additionalText: string = ''): boolean {
    const searchText = `${name} ${additionalText}`.toLowerCase();
    
    const pokemonKeywords = [
      'pokemon', 'pokémon', 'tcg', 'trading card', 'booster', 
      'elite trainer', 'battle deck', 'starter deck', 'theme deck',
      'collection box', 'tin', 'premium collection'
    ];
    
    const excludeKeywords = [
      'video game', 'plush', 'figure', 'toy', 'clothing', 
      'accessory', 'keychain', 'backpack', 'lunch box'
    ];
    
    const hasPokemonKeyword = pokemonKeywords.some(keyword => 
      searchText.includes(keyword)
    );
    
    const hasExcludeKeyword = excludeKeywords.some(keyword => 
      searchText.includes(keyword)
    );
    
    return hasPokemonKeyword && !hasExcludeKeyword;
  }

  /**
   * Common utility to parse price from various text formats
   */
  protected parsePrice(priceText: string): number {
    if (!priceText) return 0;
    
    // Handle various price formats: "$29.99", "29.99", "$29.99 - $39.99", "Member's Mark $29.99"
    const match = priceText.match(/\$?(\d+\.?\d*)/);
    return match && match[1] ? parseFloat(match[1]) : 0;
  }

  /**
   * Common utility to determine availability status from various indicators
   */
  protected determineAvailabilityStatus(
    inStock: boolean,
    availabilityText?: string,
    stockLevel?: number
  ): ProductAvailabilityResponse['availabilityStatus'] {
    if (!inStock) {
      return 'out_of_stock';
    }
    
    if (availabilityText) {
      const text = availabilityText.toLowerCase();
      if (text.includes('pre-order') || text.includes('preorder')) {
        return 'pre_order';
      }
      if (text.includes('limited') || text.includes('low stock')) {
        return 'low_stock';
      }
      if (text.includes('discontinued')) {
        return 'discontinued';
      }
    }
    
    if (stockLevel !== undefined && stockLevel > 0 && stockLevel <= 5) {
      return 'low_stock';
    }
    
    return 'in_stock';
  }

  /**
   * Common utility to build cart URL from product URL
   */
  protected buildCartUrl(productUrl: string, retailerId: string): string | undefined {
    if (!productUrl) return undefined;
    
    switch (retailerId) {
      case 'walmart':
        return `${productUrl}?athbdg=L1600`;
      case 'bestbuy':
        // Best Buy provides direct cart URLs in their API
        return undefined;
      case 'costco':
      case 'samsclub':
        // These retailers don't provide direct cart URLs
        return undefined;
      default:
        return undefined;
    }
  }

  /**
   * Common method to handle request/response logging
   */
  protected logRequest(method: string, url: string, success: boolean, responseTime: number): void {
    const logData = {
      retailerId: this.config.id,
      method,
      url,
      success,
      responseTime,
      timestamp: new Date().toISOString()
    };

    if (success) {
      logger.info(`${this.config.name} request successful`, logData);
    } else {
      logger.warn(`${this.config.name} request failed`, logData);
    }
  }

  /**
   * Enhanced updateMetrics with additional logging
   */
  protected override updateMetrics(success: boolean, responseTime: number): void {
    super.updateMetrics(success, responseTime);
    
    // Log metrics periodically
    if (this.metrics.totalRequests % 10 === 0) {
      logger.info(`${this.config.name} metrics update`, {
        retailerId: this.config.id,
        totalRequests: this.metrics.totalRequests,
        successRate: this.calculateSuccessRate(),
        averageResponseTime: this.metrics.averageResponseTime,
        rateLimitHits: this.metrics.rateLimitHits
      });
    }
  }
}