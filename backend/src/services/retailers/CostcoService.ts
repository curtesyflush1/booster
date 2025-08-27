import axios, { AxiosInstance, AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import { BaseRetailerService, RetailerConfig, ProductAvailabilityRequest, ProductAvailabilityResponse, RetailerHealthStatus, StoreLocation, RetailerError } from '../../types/retailer';
import { logger } from '../../utils/logger';

interface CostcoProduct {
  itemNumber: string;
  name: string;
  price: number;
  originalPrice?: number | undefined;
  url: string;
  imageUrl?: string | undefined;
  availability: string;
  description?: string | undefined;
  isOnSale: boolean;
}

export class CostcoService extends BaseRetailerService {
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
      logger.info(`Checking Costco availability for product: ${request.productId}`);
      
      // For Costco, we'll need to search by product name or item number
      // Since we don't have direct product mapping, we'll search
      let product: CostcoProduct | null = null;
      
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
      logger.info(`Costco availability check completed for ${request.productId}`);
      
      return response;
      
    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime);
      logger.error(`Costco availability check failed for ${request.productId}:`, error);
      
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
      logger.info(`Searching Costco products for: ${query}`);
      
      const searchQuery = `${query} pokemon tcg`;
      const response = await this.makeRequest('/CatalogSearch', {
        params: {
          keyword: searchQuery,
          dept: 'All',
          pageSize: 24
        }
      });

      const $ = cheerio.load(response.data);
      const products: CostcoProduct[] = [];

      // Parse search results from HTML
      $('.product-tile').each((index, element) => {
        try {
          const $product = $(element);
          const name = $product.find('.description a').text().trim();
          const priceText = $product.find('.price').text().trim();
          const url = $product.find('.description a').attr('href');
          const imageUrl = $product.find('.product-image img').attr('src');
          const itemNumber = $product.find('[data-item-number]').attr('data-item-number');

          if (name && priceText && url && this.isPokemonTcgProduct(name)) {
            const price = this.parsePrice(priceText);
            if (price > 0) {
              products.push({
                itemNumber: itemNumber || '',
                name,
                price,
                url: url.startsWith('http') ? url : `https://www.costco.com${url}`,
                imageUrl: imageUrl?.startsWith('http') ? imageUrl : `https://www.costco.com${imageUrl}`,
                availability: 'Available', // Would need to check individual product pages
                isOnSale: $product.find('.sale-price').length > 0
              });
            }
          }
        } catch (parseError) {
          logger.warn('Error parsing Costco product:', parseError);
        }
      });

      const results = products.map(product => 
        this.parseResponse(product, { productId: product.itemNumber || product.name })
      );

      this.updateMetrics(true, Date.now() - startTime);
      logger.info(`Costco search completed, found ${results.length} Pokemon TCG products`);
      
      return results;
      
    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime);
      logger.error(`Costco search failed for query "${query}":`, error);
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
    product: CostcoProduct, 
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
      price: product.price,
      originalPrice: product.originalPrice || undefined,
      availabilityStatus,
      productUrl: product.url,
      cartUrl: undefined, // Costco doesn't provide direct cart URLs
      storeLocations,
      lastUpdated: new Date(),
      metadata: {
        itemNumber: product.itemNumber,
        name: product.name,
        isOnSale: product.isOnSale,
        image: product.imageUrl,
        description: product.description
      }
    };
  }

  private async getProductByItemNumber(itemNumber: string): Promise<CostcoProduct | null> {
    try {
      // Costco product URLs typically follow the pattern: /product-name-item-number.product.html
      // We would need to construct or search for the URL
      const searchResults = await this.searchProducts(itemNumber);
      return searchResults.length > 0 && searchResults[0] ? this.convertToInternalProduct(searchResults[0]) : null;
    } catch (error) {
      logger.error(`Error getting Costco product by item number ${itemNumber}:`, error);
      return null;
    }
  }

  private async searchForProduct(productId: string): Promise<CostcoProduct | null> {
    try {
      // This would require mapping our internal product ID to a searchable term
      // For now, we'll return null and rely on UPC/SKU mapping
      return null;
    } catch (error) {
      logger.error(`Error searching for Costco product ${productId}:`, error);
      return null;
    }
  }

  private convertToInternalProduct(response: ProductAvailabilityResponse): CostcoProduct {
    return {
      itemNumber: response.metadata?.itemNumber || '',
      name: response.metadata?.name || '',
      price: response.price || 0,
      originalPrice: response.originalPrice ?? undefined,
      url: response.productUrl,
      imageUrl: response.metadata?.image,
      availability: response.inStock ? 'Available' : 'Out of Stock',
      description: response.metadata?.description,
      isOnSale: response.metadata?.isOnSale || false
    };
  }

  private parsePrice(priceText: string): number {
    // Extract price from text like "$29.99", "29.99", "$29.99 - $39.99"
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