import axios, { AxiosInstance, AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import { BaseRetailerService, RetailerConfig, ProductAvailabilityRequest, ProductAvailabilityResponse, RetailerHealthStatus, StoreLocation, RetailerError } from '../../types/retailer';
import { logger } from '../../utils/logger';

interface SamsClubProduct {
  itemNumber: string;
  name: string;
  price: number;
  originalPrice?: number | undefined;
  url: string;
  imageUrl?: string | undefined;
  availability: string;
  description?: string | undefined;
  isOnSale: boolean;
  memberPrice?: number | undefined;
}

export class SamsClubService extends BaseRetailerService {
  private httpClient: AxiosInstance;
  private lastRequestTime: number = 0;
  private readonly MIN_REQUEST_INTERVAL = 2000; // 2 seconds between requests for politeness

  constructor(config: RetailerConfig) {
    super(config);
    
    this.httpClient = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        ...config.headers
      }
    });

    // Add request interceptor for polite rate limiting
    this.httpClient.interceptors.request.use(async (config) => {
      if (!this.checkRateLimit()) {
        throw this.createRetailerError(
          'Rate limit exceeded',
          'RATE_LIMIT',
          429,
          true
        );
      }

      // Implement polite delay between requests
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
        const delay = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      this.lastRequestTime = Date.now();

      return config;
    });

    // Add response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 429) {
          throw this.createRetailerError(
            'Rate limit exceeded',
            'RATE_LIMIT',
            429,
            true
          );
        }
        if (error.response?.status === 403) {
          throw this.createRetailerError(
            'Access forbidden - possible bot detection',
            'AUTH',
            403,
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

  async checkAvailability(request: ProductAvailabilityRequest): Promise<ProductAvailabilityResponse> {
    const startTime = Date.now();
    
    try {
      logger.info(`Checking Sam's Club availability for product: ${request.productId}`);
      
      // For Sam's Club, we'll need to search by product name or item number
      let product: SamsClubProduct | null = null;
      
      if (request.sku) {
        product = await this.getProductByItemNumber(request.sku);
      } else {
        // Try to find by searching - this would require product name mapping
        product = await this.searchForProduct(request.productId);
      }

      if (!product) {
        throw this.createRetailerError(
          `Product not found: ${request.productId}`,
          'NOT_FOUND',
          404,
          false
        );
      }

      const response = this.parseResponse(product, request);
      
      this.updateMetrics(true, Date.now() - startTime);
      logger.info(`Sam's Club availability check completed for ${request.productId}`);
      
      return response;
      
    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime);
      logger.error(`Sam's Club availability check failed for ${request.productId}:`, error);
      
      if (error instanceof RetailerError) {
        throw error;
      }
      
      throw this.createRetailerError(
        `Failed to check availability: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SERVER_ERROR',
        500,
        true
      );
    }
  }

  async searchProducts(query: string): Promise<ProductAvailabilityResponse[]> {
    const startTime = Date.now();
    
    try {
      logger.info(`Searching Sam's Club products for: ${query}`);
      
      const searchQuery = `${query} pokemon tcg`;
      const response = await this.makeRequest('/search', {
        params: {
          searchTerm: searchQuery,
          offset: 0,
          limit: 24
        }
      });

      const $ = cheerio.load(response.data);
      const products: SamsClubProduct[] = [];

      // Parse search results from HTML
      $('.ProductTile, .sc-product-card').each((_index, element) => {
        try {
          const $product = $(element);
          const name = $product.find('.sc-product-card-title, .ProductTile-title').text().trim();
          const priceText = $product.find('.Price, .sc-price').text().trim();
          const url = $product.find('a').attr('href');
          const imageUrl = $product.find('img').attr('src') || $product.find('img').attr('data-src');
          const itemNumber = $product.attr('data-automation-id') || $product.find('[data-automation-id]').attr('data-automation-id');

          if (name && priceText && url && this.isPokemonTcgProduct(name)) {
            const price = this.parsePrice(priceText);
            if (price > 0) {
              products.push({
                itemNumber: itemNumber || '',
                name,
                price,
                url: url.startsWith('http') ? url : `https://www.samsclub.com${url}`,
                imageUrl: imageUrl?.startsWith('http') ? imageUrl : `https://www.samsclub.com${imageUrl}`,
                availability: 'Available', // Would need to check individual product pages
                isOnSale: $product.find('.sc-price-was, .Price-was').length > 0
              });
            }
          }
        } catch (parseError) {
          logger.warn('Error parsing Sam\'s Club product:', parseError);
        }
      });

      const results = products.map(product => 
        this.parseResponse(product, { productId: product.itemNumber || product.name })
      );

      this.updateMetrics(true, Date.now() - startTime);
      logger.info(`Sam's Club search completed, found ${results.length} Pokemon TCG products`);
      
      return results;
      
    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime);
      logger.error(`Sam's Club search failed for query "${query}":`, error);
      throw error;
    }
  }

  async getHealthStatus(): Promise<RetailerHealthStatus> {
    const startTime = Date.now();
    const errors: string[] = [];
    let isHealthy = true;

    try {
      // Test connectivity with a simple request to the homepage
      await this.makeRequest('/', {});
      
      const responseTime = Date.now() - startTime;
      const successRate = this.metrics.totalRequests > 0 
        ? (this.metrics.successfulRequests / this.metrics.totalRequests) * 100 
        : 100;

      // Consider unhealthy if success rate is below 80% (lower threshold for scraping)
      // or response time is above 10 seconds
      if (successRate < 80) {
        isHealthy = false;
        errors.push(`Low success rate: ${successRate.toFixed(1)}%`);
      }
      
      if (responseTime > 10000) {
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
        successRate: this.metrics.totalRequests > 0 
          ? (this.metrics.successfulRequests / this.metrics.totalRequests) * 100 
          : 0,
        lastChecked: new Date(),
        errors,
        circuitBreakerState: 'OPEN'
      };
    }
  }

  protected async makeRequest(url: string, options: any = {}): Promise<AxiosResponse> {
    return await this.httpClient.get(url, options);
  }

  protected parseResponse(
    product: SamsClubProduct, 
    request: ProductAvailabilityRequest, 
    storeLocations: StoreLocation[] = []
  ): ProductAvailabilityResponse {
    const inStock = product.availability === 'Available';
    
    let availabilityStatus: ProductAvailabilityResponse['availabilityStatus'] = 'out_of_stock';
    if (product.availability === 'Available') {
      availabilityStatus = 'in_stock';
    } else if (product.availability === 'Limited Stock') {
      availabilityStatus = 'low_stock';
    }

    return {
      productId: request.productId,
      retailerId: this.config.id,
      inStock,
      price: product.memberPrice || product.price,
      originalPrice: product.originalPrice ?? (product.memberPrice ? product.price : undefined),
      availabilityStatus,
      productUrl: product.url,
      cartUrl: undefined, // Sam's Club doesn't provide direct cart URLs
      storeLocations,
      lastUpdated: new Date(),
      metadata: {
        itemNumber: product.itemNumber,
        name: product.name,
        isOnSale: product.isOnSale,
        memberPrice: product.memberPrice,
        regularPrice: product.price,
        image: product.imageUrl,
        description: product.description
      }
    };
  }

  private async getProductByItemNumber(itemNumber: string): Promise<SamsClubProduct | null> {
    try {
      // Sam's Club product URLs typically follow the pattern: /p/product-name/item-number
      const searchResults = await this.searchProducts(itemNumber);
      return searchResults.length > 0 && searchResults[0] ? this.convertToInternalProduct(searchResults[0]) : null;
    } catch (error) {
      logger.error(`Error getting Sam's Club product by item number ${itemNumber}:`, error);
      return null;
    }
  }

  private async searchForProduct(productId: string): Promise<SamsClubProduct | null> {
    try {
      // This would require mapping our internal product ID to a searchable term
      // For now, we'll return null and rely on UPC/SKU mapping
      return null;
    } catch (error) {
      logger.error(`Error searching for Sam's Club product ${productId}:`, error);
      return null;
    }
  }

  private convertToInternalProduct(response: ProductAvailabilityResponse): SamsClubProduct {
    return {
      itemNumber: response.metadata?.itemNumber || '',
      name: response.metadata?.name || '',
      price: response.metadata?.regularPrice || response.price || 0,
      originalPrice: response.originalPrice ?? undefined,
      memberPrice: response.metadata?.memberPrice,
      url: response.productUrl,
      imageUrl: response.metadata?.image,
      availability: response.inStock ? 'Available' : 'Out of Stock',
      description: response.metadata?.description,
      isOnSale: response.metadata?.isOnSale || false
    };
  }

  private parsePrice(priceText: string): number {
    // Extract price from text like "$29.99", "29.99", "$29.99 - $39.99", "Member's Mark $29.99"
    const match = priceText.match(/\$?(\d+\.?\d*)/);
    return match && match[1] ? parseFloat(match[1]) : 0;
  }

  private isPokemonTcgProduct(name: string): boolean {
    const nameLower = name.toLowerCase();
    
    const pokemonKeywords = ['pokemon', 'pokémon', 'tcg', 'trading card', 'booster', 'elite trainer', 'battle deck'];
    const excludeKeywords = ['video game', 'plush', 'figure', 'toy', 'clothing', 'accessory'];
    
    const hasPokemonKeyword = pokemonKeywords.some(keyword => 
      nameLower.includes(keyword)
    );
    
    const hasExcludeKeyword = excludeKeywords.some(keyword => 
      nameLower.includes(keyword)
    );
    
    return hasPokemonKeyword && !hasExcludeKeyword;
  }
}