import { AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import { RetailerConfig, ProductAvailabilityRequest, ProductAvailabilityResponse, StoreLocation, RetailerError } from '../../types/retailer';
import { BaseRetailerService } from './BaseRetailerService';
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
  constructor(config: RetailerConfig) {
    super(config);
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

  /**
   * Costco specific health check
   */
  protected override async performHealthCheck(): Promise<void> {
    await this.makeRequest('/', {});
  }

  protected parseResponse(
    product: CostcoProduct, 
    request: ProductAvailabilityRequest, 
    storeLocations: StoreLocation[] = []
  ): ProductAvailabilityResponse {
    const inStock = product.availability === 'Available';
    const availabilityStatus = this.determineAvailabilityStatus(inStock, product.availability);

    return {
      productId: request.productId,
      retailerId: this.config.id,
      inStock,
      price: product.price,
      originalPrice: product.originalPrice || undefined,
      availabilityStatus,
      productUrl: product.url,
      cartUrl: this.buildCartUrl(product.url, this.config.id),
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


}