import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { RetailerConfig, ProductAvailabilityRequest, ProductAvailabilityResponse, StoreLocation, RetailerError } from '../../types/retailer';
import { BaseRetailerService } from './BaseRetailerService';
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
  constructor(config: RetailerConfig) {
    super(config);
    
    if (!config.apiKey) {
      throw new Error('Best Buy API key is required');
    }
  }

  /**
   * Override header creation to match Best Buy's requirements
   */
  protected override createHttpClient(): AxiosInstance {
    return axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'User-Agent': 'BoosterBeacon/1.0',
        ...this.config.headers
      }
    });
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
      
      // Best Buy v1 API expects filters in the path parentheses, and apiKey as 'apiKey'
      const encoded = encodeURIComponent(query);
      const response = await this.makeRequest(`/products(search=${encoded})`, {
        params: {
          apiKey: this.config.apiKey,
          format: 'json',
          show: 'sku,name,regularPrice,salePrice,onSale,url,addToCartUrl,inStoreAvailability,onlineAvailability,image,categoryPath',
          pageSize: 20
        }
      });

      const products = response.data.products || [];
      const results: ProductAvailabilityResponse[] = [];



      for (const product of products) {
        // Filter for Pokemon TCG products
        if (this.isPokemonTcgProduct(product.name, product.categoryPath?.map(cat => cat.name).join(' ') || '')) {
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

  /**
   * Best Buy specific health check
   */
  protected override async performHealthCheck(): Promise<void> {
    await this.makeRequest('/products', {
      params: {
        apikey: this.config.apiKey,
        format: 'json',
        pageSize: 1
      }
    });
  }

  protected parseResponse(
    product: BestBuyProduct, 
    request: ProductAvailabilityRequest, 
    storeLocations: StoreLocation[] = []
  ): ProductAvailabilityResponse {
    const inStock = product.onlineAvailability || product.inStoreAvailability;
    const price = product.salePrice || product.regularPrice;
    const availabilityText = inStock ? 'Available' : 'Out of Stock';
    
    const availabilityStatus = this.determineAvailabilityStatus(inStock, availabilityText);

    // Fallback cart URL: if API doesn't provide a usable addToCartUrl, attempt a best-effort deep link by SKU
    let cartUrl = product.addToCartUrl;
    if (!cartUrl || /\/cart\/?$/.test(cartUrl)) {
      try {
        const skuId = String(product.sku);
        if (skuId && /^\d+$/.test(skuId)) {
          cartUrl = `https://www.bestbuy.com/cart?skuId=${encodeURIComponent(skuId)}`;
        }
      } catch {}
    }

    return {
      productId: request.productId,
      retailerId: this.config.id,
      inStock,
      price,
      originalPrice: product.regularPrice !== price ? product.regularPrice : undefined,
      availabilityStatus,
      productUrl: product.url,
      cartUrl,
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
      const response = await this.httpClient.get(`/products/${encodeURIComponent(sku)}`, {
        params: {
          apikey: this.config.apiKey,
          format: 'json',
          show: 'sku,name,regularPrice,salePrice,onSale,url,addToCartUrl,inStoreAvailability,onlineAvailability,image,categoryPath'
        }
      });
      const data = response.data as any;
      // Some endpoints return product directly, others under products[]
      const product = data?.products?.[0] || data;
      return product ? (product as BestBuyProduct) : null;
    } catch (error) {
      if ((error as any).response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  private async getProductByUpc(upc: string): Promise<BestBuyProduct | null> {
    try {
      const response = await this.httpClient.get('/products', {
        params: {
          apikey: this.config.apiKey,
          format: 'json',
          upc: upc,
          show: 'sku,name,regularPrice,salePrice,onSale,url,addToCartUrl,inStoreAvailability,onlineAvailability,image,categoryPath',
          pageSize: 1
        }
      });
      const products = (response.data as any)?.products || [];
      return products.length > 0 ? (products[0] as BestBuyProduct) : null;
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
          apikey: this.config.apiKey,
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


}
