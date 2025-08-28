import { AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import { RetailerConfig, ProductAvailabilityRequest, ProductAvailabilityResponse, StoreLocation, RetailerError } from '../../types/retailer';
import { BaseRetailerService } from './BaseRetailerService';
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
  constructor(config: RetailerConfig) {
    super(config);
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

  /**
   * Sam's Club specific health check
   */
  protected override async performHealthCheck(): Promise<void> {
    await this.makeRequest('/', {});
  }

  protected parseResponse(
    product: SamsClubProduct, 
    request: ProductAvailabilityRequest, 
    storeLocations: StoreLocation[] = []
  ): ProductAvailabilityResponse {
    const inStock = product.availability === 'Available';
    const availabilityStatus = this.determineAvailabilityStatus(inStock, product.availability);

    return {
      productId: request.productId,
      retailerId: this.config.id,
      inStock,
      price: product.memberPrice || product.price,
      originalPrice: product.originalPrice ?? (product.memberPrice ? product.price : undefined),
      availabilityStatus,
      productUrl: product.url,
      cartUrl: this.buildCartUrl(product.url, this.config.id),
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


}