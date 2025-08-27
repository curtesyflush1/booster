import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { BaseRetailerService, RetailerConfig, ProductAvailabilityRequest, ProductAvailabilityResponse, RetailerHealthStatus, StoreLocation, RetailerError } from '../../types/retailer';
import { logger } from '../../utils/logger';

interface WalmartProduct {
  itemId: number;
  name: string;
  salePrice: number;
  msrp?: number;
  productUrl: string;
  addToCartUrl?: string;
  availabilityStatus: string;
  stock: string;
  imageEntities?: Array<{
    thumbnailImage: string;
    mediumImage: string;
    largeImage: string;
  }>;
  categoryPath: string;
  categoryNode: string;
  brandName?: string;
  shortDescription?: string;
  upc?: string;
  modelNumber?: string;
}

interface WalmartSearchResponse {
  query: string;
  sort: string;
  responseGroup: string;
  totalResults: number;
  start: number;
  numItems: number;
  items: WalmartProduct[];
}

interface WalmartStoreLocator {
  payload: {
    stores: Array<{
      id: string;
      displayName: string;
      storeType: {
        displayName: string;
      };
      address: {
        address: string;
        city: string;
        state: string;
        postalCode: string;
      };
      phone: string;
      geoPoint: {
        latitude: number;
        longitude: number;
      };
      distance?: number;
    }>;
  };
}

export class WalmartService extends BaseRetailerService {
  private httpClient: AxiosInstance;
  private apiKey: string;

  constructor(config: RetailerConfig) {
    super(config);
    
    if (!config.apiKey) {
      throw new Error('Walmart API key is required');
    }
    
    this.apiKey = config.apiKey;
    this.httpClient = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout,
      headers: {
        'WM_SVC.NAME': 'Walmart Open API',
        'WM_CONSUMER.ID': this.apiKey,
        'Accept': 'application/json',
        'User-Agent': 'BoosterBeacon/1.0',
        ...config.headers
      }
    });

    // Add request interceptor for rate limiting
    this.httpClient.interceptors.request.use((config) => {
      if (!this.checkRateLimit()) {
        throw this.createRetailerError(
          'Rate limit exceeded',
          'RATE_LIMIT',
          429,
          true
        );
      }
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
        if (error.response?.status === 401 || error.response?.status === 403) {
          throw this.createRetailerError(
            'Authentication failed',
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

  async checkAvailability(request: ProductAvailabilityRequest): Promise<ProductAvailabilityResponse> {
    const startTime = Date.now();
    
    try {
      logger.info(`Checking Walmart availability for product: ${request.productId}`);
      
      // First, try to find the product by UPC or item ID
      let product: WalmartProduct | null = null;
      
      if (request.upc) {
        product = await this.getProductByUpc(request.upc);
      } else {
        // Try to find by our internal product ID mapping or assume it's a Walmart item ID
        product = await this.getProductByItemId(request.productId);
      }

      if (!product) {
        throw this.createRetailerError(
          `Product not found: ${request.productId}`,
          'NOT_FOUND',
          404,
          false
        );
      }

      // Get store availability if location is specified
      let storeLocations: StoreLocation[] = [];
      if (request.zipCode) {
        storeLocations = await this.getStoreLocations(request.zipCode, request.radiusMiles);
      }

      const response = this.parseResponse(product, request, storeLocations);
      
      this.updateMetrics(true, Date.now() - startTime);
      logger.info(`Walmart availability check completed for ${request.productId}`);
      
      return response;
      
    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime);
      logger.error(`Walmart availability check failed for ${request.productId}:`, error);
      
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
      logger.info(`Searching Walmart products for: ${query}`);
      
      const response = await this.makeRequest('/search', {
        params: {
          query: `${query} pokemon tcg`,
          format: 'json',
          categoryId: '4171', // Trading Cards category
          numItems: 25,
          start: 1
        }
      });

      const searchData: WalmartSearchResponse = response.data;
      const products = searchData.items || [];
      const results: ProductAvailabilityResponse[] = [];

      for (const product of products) {
        // Filter for Pokemon TCG products
        if (this.isPokemonTcgProduct(product)) {
          results.push(this.parseResponse(product, { productId: product.itemId.toString() }));
        }
      }

      this.updateMetrics(true, Date.now() - startTime);
      logger.info(`Walmart search completed, found ${results.length} Pokemon TCG products`);
      
      return results;
      
    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime);
      logger.error(`Walmart search failed for query "${query}":`, error);
      throw error;
    }
  }

  async getHealthStatus(): Promise<RetailerHealthStatus> {
    const startTime = Date.now();
    const errors: string[] = [];
    let isHealthy = true;

    try {
      // Test API connectivity with a simple search request
      await this.makeRequest('/search', {
        params: {
          query: 'pokemon',
          format: 'json',
          numItems: 1
        }
      });
      
      const responseTime = Date.now() - startTime;
      const successRate = this.metrics.totalRequests > 0 
        ? (this.metrics.successfulRequests / this.metrics.totalRequests) * 100 
        : 100;

      // Consider unhealthy if success rate is below 90% or response time is above 5 seconds
      if (successRate < 90) {
        isHealthy = false;
        errors.push(`Low success rate: ${successRate.toFixed(1)}%`);
      }
      
      if (responseTime > 5000) {
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
    product: WalmartProduct, 
    request: ProductAvailabilityRequest, 
    storeLocations: StoreLocation[] = []
  ): ProductAvailabilityResponse {
    const inStock = product.availabilityStatus === 'Available' || product.stock === 'Available';
    const price = product.salePrice;
    
    let availabilityStatus: ProductAvailabilityResponse['availabilityStatus'] = 'out_of_stock';
    if (product.availabilityStatus === 'Available') {
      availabilityStatus = 'in_stock';
    } else if (product.availabilityStatus === 'Limited Stock') {
      availabilityStatus = 'low_stock';
    } else if (product.availabilityStatus === 'Pre-order') {
      availabilityStatus = 'pre_order';
    }

    // Generate cart URL from product URL
    const cartUrl = product.productUrl ? `${product.productUrl}?athbdg=L1600` : undefined;

    return {
      productId: request.productId,
      retailerId: this.config.id,
      inStock,
      price,
      originalPrice: product.msrp && product.msrp !== price ? product.msrp : undefined,
      availabilityStatus,
      productUrl: product.productUrl,
      cartUrl,
      storeLocations,
      lastUpdated: new Date(),
      metadata: {
        itemId: product.itemId,
        name: product.name,
        upc: product.upc,
        brandName: product.brandName,
        categoryPath: product.categoryPath,
        shortDescription: product.shortDescription,
        image: product.imageEntities?.[0]?.mediumImage || undefined
      }
    };
  }

  private async getProductByUpc(upc: string): Promise<WalmartProduct | null> {
    try {
      const response = await this.makeRequest('/items', {
        params: {
          upc: upc,
          format: 'json'
        }
      });
      
      const items = response.data.items || [];
      return items.length > 0 ? items[0] : null;
    } catch (error) {
      if ((error as any).response?.status === 404) {
        return null;
      }
      logger.error(`Error searching Walmart by UPC ${upc}:`, error);
      return null;
    }
  }

  private async getProductByItemId(itemId: string): Promise<WalmartProduct | null> {
    try {
      const response = await this.makeRequest(`/items/${itemId}`, {
        params: {
          format: 'json'
        }
      });
      
      return response.data || null;
    } catch (error) {
      if ((error as any).response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  private async getStoreLocations(zipCode: string, radiusMiles: number = 25): Promise<StoreLocation[]> {
    try {
      // Note: Walmart's store locator API might be different or require different authentication
      // This is a simplified implementation
      const response = await this.httpClient.get('/stores', {
        params: {
          zip: zipCode,
          radius: radiusMiles,
          format: 'json'
        },
        headers: {
          // Store locator might use different headers
          'Accept': 'application/json'
        }
      });

      const storeData: WalmartStoreLocator = response.data;
      
      return storeData.payload.stores.map(store => ({
        storeId: store.id,
        storeName: store.displayName,
        address: store.address.address,
        city: store.address.city,
        state: store.address.state,
        zipCode: store.address.postalCode,
        phone: store.phone,
        distanceMiles: store.distance,
        inStock: true, // Would need to check individual store inventory
        stockLevel: undefined
      }));
      
    } catch (error) {
      logger.error(`Error getting Walmart store locations for ZIP ${zipCode}:`, error);
      return [];
    }
  }

  private isPokemonTcgProduct(product: WalmartProduct): boolean {
    const name = product.name.toLowerCase();
    const categoryPath = product.categoryPath?.toLowerCase() || '';
    const brandName = product.brandName?.toLowerCase() || '';
    const description = product.shortDescription?.toLowerCase() || '';
    
    const pokemonKeywords = ['pokemon', 'pokémon', 'tcg', 'trading card', 'booster', 'elite trainer', 'battle deck'];
    const excludeKeywords = ['video game', 'plush', 'figure', 'toy', 'clothing', 'accessory'];
    
    const searchText = `${name} ${categoryPath} ${brandName} ${description}`;
    
    const hasPokemonKeyword = pokemonKeywords.some(keyword => 
      searchText.includes(keyword)
    );
    
    const hasExcludeKeyword = excludeKeywords.some(keyword => 
      searchText.includes(keyword)
    );
    
    return hasPokemonKeyword && !hasExcludeKeyword;
  }
}