import { AxiosResponse } from 'axios';
import { RetailerConfig, ProductAvailabilityRequest, ProductAvailabilityResponse, StoreLocation, RetailerError } from '../../types/retailer';
import { BaseRetailerService } from './BaseRetailerService';
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
  constructor(config: RetailerConfig) {
    // Add Walmart-specific headers to config
    const walmartConfig = {
      ...config,
      headers: {
        ...config.headers,
        'WM_CONSUMER.ID': config.apiKey,
        'WM_SVC.NAME': 'Walmart Open API'
      }
    };
    
    super(walmartConfig);
    
    if (!config.apiKey) {
      throw new Error('Walmart API key is required');
    }
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
        const additionalText = `${product.categoryPath || ''} ${product.brandName || ''} ${product.shortDescription || ''}`;
        if (this.isPokemonTcgProduct(product.name, additionalText)) {
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

  /**
   * Walmart specific health check
   */
  protected override async performHealthCheck(): Promise<void> {
    await this.makeRequest('/search', {
      params: {
        query: 'pokemon',
        format: 'json',
        numItems: 1
      }
    });
  }

  protected parseResponse(
    product: WalmartProduct, 
    request: ProductAvailabilityRequest, 
    storeLocations: StoreLocation[] = []
  ): ProductAvailabilityResponse {
    const inStock = product.availabilityStatus === 'Available' || product.stock === 'Available';
    const price = product.salePrice;
    
    const availabilityStatus = this.determineAvailabilityStatus(inStock, product.availabilityStatus);

    // Generate cart URL from product URL
    const cartUrl = this.buildCartUrl(product.productUrl, this.config.id);

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


}