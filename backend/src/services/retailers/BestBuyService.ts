import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { BaseRetailerService, RetailerConfig, ProductAvailabilityRequest, ProductAvailabilityResponse, RetailerHealthStatus, StoreLocation, RetailerError } from '../../types/retailer';
import { logger } from '../../utils/logger';

interface BestBuyProduct {
  sku: number;
  name: string;
  regularPrice: number;
  salePrice?: number;
  onSale: boolean;
  url: string;
  addToCartUrl?: string;
  inStoreAvailability: boolean;
  onlineAvailability: boolean;
  image: string;
  categoryPath: Array<{ id: string; name: string }>;
  details?: {
    value: string;
  };
}

interface BestBuyStoreAvailability {
  stores: Array<{
    storeId: number;
    storeName: string;
    address: string;
    city: string;
    region: string;
    postalCode: string;
    phone: string;
    distance: number;
    lowStock: boolean;
    inStoreAvailability: boolean;
  }>;
}

export class BestBuyService extends BaseRetailerService {
  private httpClient: AxiosInstance;
  private apiKey: string;

  constructor(config: RetailerConfig) {
    super(config);
    
    if (!config.apiKey) {
      throw new Error('Best Buy API key is required');
    }
    
    this.apiKey = config.apiKey;
    this.httpClient = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout,
      headers: {
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
      logger.info(`Checking Best Buy availability for product: ${request.productId}`);
      
      // First, try to find the product by SKU or UPC
      let product: BestBuyProduct | null = null;
      
      if (request.sku) {
        product = await this.getProductBySku(request.sku);
      } else if (request.upc) {
        product = await this.getProductByUpc(request.upc);
      } else {
        // Try to find by our internal product ID mapping
        product = await this.getProductByInternalId(request.productId);
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
        storeLocations = await this.getStoreAvailability(product.sku.toString(), request.zipCode, request.radiusMiles);
      }

      const response = this.parseResponse(product, request, storeLocations);
      
      this.updateMetrics(true, Date.now() - startTime);
      logger.info(`Best Buy availability check completed for ${request.productId}`);
      
      return response;
      
    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime);
      logger.error(`Best Buy availability check failed for ${request.productId}:`, error);
      
      if (error instanceof RetailerError) {
        throw error;
      }

      // Handle axios errors
      if ((error as any).response?.status === 429) {
        throw this.createRetailerError(
          'Rate limit exceeded',
          'RATE_LIMIT',
          429,
          true
        );
      }
      if ((error as any).response?.status === 401 || (error as any).response?.status === 403) {
        throw this.createRetailerError(
          'Authentication failed',
          'AUTH',
          (error as any).response.status,
          false
        );
      }
      if ((error as any).code === 'ECONNABORTED' || (error as any).code === 'ENOTFOUND') {
        throw this.createRetailerError(
          'Network error',
          'NETWORK',
          undefined,
          true
        );
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
      logger.info(`Searching Best Buy products for: ${query}`);
      
      const response = await this.makeRequest('/products', {
        params: {
          apikey: this.apiKey,
          q: query,
          format: 'json',
          show: 'sku,name,regularPrice,salePrice,onSale,url,addToCartUrl,inStoreAvailability,onlineAvailability,image,categoryPath',
          pageSize: 20
        }
      });

      const products = response.data.products || [];
      const results: ProductAvailabilityResponse[] = [];



      for (const product of products) {
        // Filter for Pokemon TCG products
        if (this.isPokemonTcgProduct(product)) {
          results.push(this.parseResponse(product, { productId: product.sku.toString() }));
        }
      }

      this.updateMetrics(true, Date.now() - startTime);
      logger.info(`Best Buy search completed, found ${results.length} Pokemon TCG products`);
      
      return results;
      
    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime);
      logger.error(`Best Buy search failed for query "${query}":`, error);
      throw error;
    }
  }

  async getHealthStatus(): Promise<RetailerHealthStatus> {
    const startTime = Date.now();
    const errors: string[] = [];
    let isHealthy = true;

    try {
      // Test API connectivity with a simple request
      await this.makeRequest('/products', {
        params: {
          apikey: this.apiKey,
          format: 'json',
          pageSize: 1
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
        circuitBreakerState: 'CLOSED' // Will be updated by circuit breaker
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
    product: BestBuyProduct, 
    request: ProductAvailabilityRequest, 
    storeLocations: StoreLocation[] = []
  ): ProductAvailabilityResponse {
    const inStock = product.onlineAvailability || product.inStoreAvailability;
    const price = product.salePrice || product.regularPrice;
    
    let availabilityStatus: ProductAvailabilityResponse['availabilityStatus'] = 'out_of_stock';
    if (product.onlineAvailability) {
      availabilityStatus = 'in_stock';
    } else if (product.inStoreAvailability) {
      availabilityStatus = 'in_stock';
    }

    return {
      productId: request.productId,
      retailerId: this.config.id,
      inStock,
      price,
      originalPrice: product.regularPrice !== price ? product.regularPrice : undefined,
      availabilityStatus,
      productUrl: product.url,
      cartUrl: product.addToCartUrl,
      storeLocations,
      lastUpdated: new Date(),
      metadata: {
        sku: product.sku,
        name: product.name,
        onSale: product.onSale,
        image: product.image,
        categoryPath: product.categoryPath
      }
    };
  }

  private async getProductBySku(sku: string): Promise<BestBuyProduct | null> {
    try {
      const response = await this.makeRequest(`/products/${sku}`, {
        params: {
          apikey: this.apiKey,
          format: 'json',
          show: 'sku,name,regularPrice,salePrice,onSale,url,addToCartUrl,inStoreAvailability,onlineAvailability,image,categoryPath'
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

  private async getProductByUpc(upc: string): Promise<BestBuyProduct | null> {
    try {
      const response = await this.makeRequest('/products', {
        params: {
          apikey: this.apiKey,
          format: 'json',
          upc: upc,
          show: 'sku,name,regularPrice,salePrice,onSale,url,addToCartUrl,inStoreAvailability,onlineAvailability,image,categoryPath',
          pageSize: 1
        }
      });
      
      const products = response.data.products || [];
      return products.length > 0 ? products[0] : null;
    } catch (error) {
      logger.error(`Error searching Best Buy by UPC ${upc}:`, error);
      return null;
    }
  }

  private async getProductByInternalId(productId: string): Promise<BestBuyProduct | null> {
    // This would typically involve a database lookup to map our internal product ID
    // to Best Buy SKU/UPC. For now, we'll assume the productId might be a SKU
    if (/^\d+$/.test(productId)) {
      return await this.getProductBySku(productId);
    }
    return null;
  }

  private async getStoreAvailability(sku: string, zipCode: string, radiusMiles: number = 25): Promise<StoreLocation[]> {
    try {
      const response = await this.makeRequest(`/products/${sku}/stores`, {
        params: {
          apikey: this.apiKey,
          format: 'json',
          area: `${zipCode},${radiusMiles}`,
          show: 'storeId,storeName,address,city,region,postalCode,phone,distance,lowStock,inStoreAvailability'
        }
      });

      const storeData: BestBuyStoreAvailability = response.data;
      
      return storeData.stores.map(store => ({
        storeId: store.storeId.toString(),
        storeName: store.storeName,
        address: store.address,
        city: store.city,
        state: store.region,
        zipCode: store.postalCode,
        phone: store.phone,
        distanceMiles: store.distance,
        inStock: store.inStoreAvailability,
        stockLevel: store.lowStock ? 1 : undefined as number | undefined
      }));
      
    } catch (error) {
      logger.error(`Error getting Best Buy store availability for SKU ${sku}:`, error);
      return [];
    }
  }

  private isPokemonTcgProduct(product: BestBuyProduct): boolean {
    const name = product.name.toLowerCase();
    const categoryNames = product.categoryPath?.map(cat => cat.name.toLowerCase()).join(' ') || '';
    
    const pokemonKeywords = ['pokemon', 'pokémon', 'tcg', 'trading card', 'booster', 'elite trainer', 'battle deck'];
    const excludeKeywords = ['video game', 'plush', 'figure', 'toy', 'clothing', 'accessory'];
    
    const searchText = `${name} ${categoryNames}`;
    
    const hasPokemonKeyword = pokemonKeywords.some(keyword => 
      searchText.includes(keyword)
    );
    
    const hasExcludeKeyword = excludeKeywords.some(keyword => 
      searchText.includes(keyword)
    );
    

    return hasPokemonKeyword && !hasExcludeKeyword;
  }
}