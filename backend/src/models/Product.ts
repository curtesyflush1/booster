import { BaseModel } from './BaseModel';
import { IProduct, IValidationError, IPaginatedResult } from '../types/database';
import { safeCount, safeStatsMap } from '../utils/database';
import { handleDatabaseError } from '../config/database';
import { logger } from '../utils/logger';
import { VALIDATION_LIMITS, STRING_LIMITS, DEFAULT_VALUES, NUMERIC_LIMITS, DATABASE_CONSTANTS } from '../constants';

// Type for product availability data with retailer information
interface IProductAvailability {
  id: string;
  product_id: string;
  retailer_id: string;
  price: number;
  in_stock: boolean;
  availability_status: string;
  url: string;
  cart_url: string;
  last_checked: Date;
  store_locations: any;
  retailer_name: string;
  retailer_slug: string;
}

// Type for product with availability information
type IProductWithAvailability = IProduct & { availability: IProductAvailability[] };

export class Product extends BaseModel<IProduct> {
  protected static override tableName = 'products';

  // Validation rules for product data
  validate(data: Partial<IProduct>): IValidationError[] {
    const errors: IValidationError[] = [];

    // Name validation
    if (data.name !== undefined) {
      const nameError = Product.validateRequired(data.name, 'name') ||
        Product.validateLength(data.name, 'name', 1, VALIDATION_LIMITS.MAX_NAME_LENGTH);
      if (nameError) errors.push(nameError);
    }

    // Slug validation
    if (data.slug !== undefined) {
      const slugError = Product.validateRequired(data.slug, 'slug') ||
        Product.validateLength(data.slug, 'slug', 1, VALIDATION_LIMITS.MAX_SLUG_LENGTH);
      if (slugError) errors.push(slugError);

      // Slug format validation (lowercase, hyphens, alphanumeric)
      if (data.slug && !/^[a-z0-9-]+$/.test(data.slug)) {
        errors.push({
          field: 'slug',
          message: 'Slug must contain only lowercase letters, numbers, and hyphens',
          value: data.slug
        });
      }
    }

    // SKU validation
    if (data.sku !== undefined && data.sku !== null) {
      const skuError = Product.validateLength(data.sku, 'sku', STRING_LIMITS.PRODUCT_SKU_MIN, STRING_LIMITS.PRODUCT_SKU_MAX);
      if (skuError) errors.push(skuError);
    }

    // UPC validation
    if (data.upc !== undefined && data.upc !== null) {
      const upcError = Product.validateLength(data.upc, 'upc', VALIDATION_LIMITS.MIN_UPC_LENGTH, VALIDATION_LIMITS.MAX_UPC_LENGTH);
      if (upcError) errors.push(upcError);

      // UPC format validation (numeric only)
      if (data.upc && !/^\d+$/.test(data.upc)) {
        errors.push({
          field: 'upc',
          message: 'UPC must contain only numbers',
          value: data.upc
        });
      }
    }

    // MSRP validation
    if (data.msrp !== undefined && data.msrp !== null) {
      const msrpError = Product.validateNumeric(data.msrp, 'msrp', VALIDATION_LIMITS.MIN_PRICE, VALIDATION_LIMITS.MAX_PRICE);
      if (msrpError) errors.push(msrpError);
    }

    // Set name validation
    if (data.set_name !== undefined && data.set_name !== null) {
      const setError = Product.validateLength(data.set_name, 'set_name', 1, VALIDATION_LIMITS.MAX_SET_NAME_LENGTH);
      if (setError) errors.push(setError);
    }

    // Series validation
    if (data.series !== undefined && data.series !== null) {
      const seriesError = Product.validateLength(data.series, 'series', 1, VALIDATION_LIMITS.MAX_SERIES_LENGTH);
      if (seriesError) errors.push(seriesError);
    }

    // Image URL validation
    if (data.image_url !== undefined && data.image_url !== null) {
      const urlError = Product.validateLength(data.image_url, 'image_url', 1, VALIDATION_LIMITS.MAX_IMAGE_URL_LENGTH);
      if (urlError) errors.push(urlError);

      // Basic URL format validation
      if (data.image_url && !data.image_url.match(/^https?:\/\/.+/)) {
        errors.push({
          field: 'image_url',
          message: 'Image URL must be a valid HTTP/HTTPS URL',
          value: data.image_url
        });
      }
    }

    // Popularity score validation
    if (data.popularity_score !== undefined) {
      const popularityError = Product.validateNumeric(data.popularity_score, 'popularity_score', VALIDATION_LIMITS.MIN_POPULARITY_SCORE, VALIDATION_LIMITS.MAX_POPULARITY_SCORE);
      if (popularityError) errors.push(popularityError);
    }

    return errors;
  }

  // Sanitize product input
  sanitize(data: Partial<IProduct>): Partial<IProduct> {
    const sanitized: Partial<IProduct> = { ...data };

    // Import sanitization utilities
    const { sanitizeUserContent, sanitizeBasicText } = require('../utils/contentSanitization');

    // Sanitize string fields with appropriate content types
    if (sanitized.name) {
      sanitized.name = sanitizeUserContent(sanitized.name, 'plain_text');
    }
    if (sanitized.slug) {
      sanitized.slug = sanitizeBasicText(sanitized.slug, 100).toLowerCase();
    }
    if (sanitized.sku) {
      sanitized.sku = sanitizeBasicText(sanitized.sku, 50).toUpperCase();
    }
    if (sanitized.upc) {
      sanitized.upc = sanitizeBasicText(sanitized.upc, 20);
    }
    if (sanitized.set_name) {
      sanitized.set_name = sanitizeUserContent(sanitized.set_name, 'plain_text');
    }
    if (sanitized.series) {
      sanitized.series = sanitizeUserContent(sanitized.series, 'plain_text');
    }
    if (sanitized.image_url) {
      sanitized.image_url = sanitized.image_url.trim();
    }
    if (sanitized.description) {
      sanitized.description = sanitizeUserContent(sanitized.description, 'product_description');
    }

    // Ensure metadata is an object
    if (!sanitized.metadata) {
      sanitized.metadata = {};
    }

    // Set default values
    if (sanitized.is_active === undefined) {
      sanitized.is_active = true;
    }
    if (sanitized.popularity_score === undefined) {
      sanitized.popularity_score = 0;
    }

    return sanitized;
  }

  // Create product with validation
  static async createProduct(productData: Partial<IProduct>): Promise<IProduct> {
    const product = new Product();
    const sanitizedData = product.sanitize(productData);

    // Validate the data
    const errors = product.validate(sanitizedData);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
    }

    return this.create<IProduct>(sanitizedData);
  }

  // Find product by slug
  static async findBySlug(slug: string): Promise<IProduct | null> {
    return this.findOneBy<IProduct>({ slug: slug.toLowerCase() });
  }

  /**
   * Simple batch fetch by IDs (no availability join).
   */
  static async findByIds(ids: string[]): Promise<IProduct[]> {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    return this.getKnex()(this.getTableName()).whereIn('id', ids);
  }

  /**
   * Batch fetch products by IDs including availability joined with retailers.
   */
  static async findByIdsWithAvailability(ids: string[]): Promise<Array<IProduct & { availability: any[] }>> {
    // Fetch products
    const products: IProduct[] = await this.getKnex()(this.getTableName()).whereIn('id', ids);
    if (!products || products.length === 0) return [] as any;

    // Fetch availability for these products and join retailer info
    const rows = await this.getKnex()('product_availability')
      .select(
        'product_availability.id',
        'product_availability.product_id',
        'product_availability.retailer_id',
        'product_availability.in_stock',
        'product_availability.price',
        'product_availability.original_price',
        'product_availability.availability_status',
        'product_availability.product_url',
        'product_availability.cart_url',
        'product_availability.store_locations',
        'product_availability.last_checked',
        'retailers.name as retailer_name',
        'retailers.slug as retailer_slug'
      )
      .leftJoin('retailers', 'product_availability.retailer_id', 'retailers.id')
      .whereIn('product_availability.product_id', ids);

    const availabilityByProduct = new Map<string, any[]>();
    for (const r of rows) {
      const list = availabilityByProduct.get(String(r.product_id)) || [];
      list.push({
        id: r.id,
        product_id: r.product_id,
        retailer_id: r.retailer_id,
        in_stock: r.in_stock,
        price: r.price,
        original_price: r.original_price,
        availability_status: r.availability_status,
        product_url: r.product_url,
        cart_url: r.cart_url,
        store_locations: r.store_locations,
        last_checked: r.last_checked,
        retailer_name: r.retailer_name,
        retailer_slug: r.retailer_slug
      });
      availabilityByProduct.set(String(r.product_id), list);
    }

    // Attach availability to corresponding product
    return products.map((p) => ({
      ...(p as any),
      availability: availabilityByProduct.get(String((p as any).id)) || []
    }));
  }

  // Find product by UPC
  static async findByUPC(upc: string): Promise<IProduct | null> {
    if (!upc || typeof upc !== 'string') {
      return null;
    }
    return this.findOneBy<IProduct>({ upc: upc.trim() });
  }

  // Find product by SKU
  static async findBySKU(sku: string): Promise<IProduct | null> {
    return this.findOneBy<IProduct>({ sku: sku.trim().toUpperCase() });
  }

  // Search products by name or description
  static async search(
    searchTerm: string,
    options: {
      category_id?: string;
      set_name?: string;
      series?: string;
      is_active?: boolean;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<IPaginatedResult<IProduct>> {
    try {
      const {
        category_id,
        set_name,
        series,
        is_active = true,
        page = DEFAULT_VALUES.DEFAULT_PAGE,
        limit = DEFAULT_VALUES.DEFAULT_LIMIT
      } = options;

      let query = this.db(this.getTableName())
        .where('is_active', is_active);

      // Add search term filtering
      if (searchTerm) {
        query = query.where(function () {
          this.where('name', 'ILIKE', `%${searchTerm}%`)
            .orWhere('description', 'ILIKE', `%${searchTerm}%`)
            .orWhere('set_name', 'ILIKE', `%${searchTerm}%`)
            .orWhere('series', 'ILIKE', `%${searchTerm}%`);
        });
      }

      // Add filters
      if (category_id) {
        query = query.where('category_id', category_id);
      }
      if (set_name) {
        query = query.where('set_name', 'ILIKE', `%${set_name}%`);
      }
      if (series) {
        query = query.where('series', 'ILIKE', `%${series}%`);
      }

      return this.getPaginatedResults<IProduct>(
        query, 
        page, 
        limit, 
        'popularity_score', 
        'desc'
      );
    } catch (error) {
      logger.error(`Error searching products:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Get products by category
  static async findByCategory(
    categoryId: string,
    options: {
      is_active?: boolean;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<IPaginatedResult<IProduct>> {
    try {
      const { is_active = true, page = DEFAULT_VALUES.DEFAULT_PAGE, limit = DEFAULT_VALUES.DEFAULT_LIMIT } = options;

      let query = this.db(this.getTableName())
        .where('category_id', categoryId)
        .where('is_active', is_active);

      return this.getPaginatedResults<IProduct>(
        query, 
        page, 
        limit, 
        'popularity_score', 
        'desc'
      );
    } catch (error) {
      logger.error(`Error finding products by category:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Get products by set with pagination
  static async findBySet(
    setName: string,
    options: {
      page?: number;
      limit?: number;
      orderBy?: string;
      orderDirection?: 'asc' | 'desc';
    } = {}
  ): Promise<IPaginatedResult<IProduct>> {
    return this.findBy<IProduct>({
      set_name: setName,
      is_active: true
    }, options);
  }

  // Update popularity score
  static async updatePopularityScore(productId: string, score: number): Promise<boolean> {
    const updated = await this.updateById<IProduct>(productId, {
      popularity_score: Math.max(VALIDATION_LIMITS.MIN_POPULARITY_SCORE, Math.min(VALIDATION_LIMITS.MAX_POPULARITY_SCORE, score))
    });
    return updated !== null;
  }

  // Increment popularity score
  static async incrementPopularity(productId: string, increment: number = 1): Promise<boolean> {
    const product = await this.findById<IProduct>(productId);
    if (!product) return false;

    const newScore = Math.min(VALIDATION_LIMITS.MAX_POPULARITY_SCORE, product.popularity_score + increment);
    return this.updatePopularityScore(productId, newScore);
  }

  // Get popular products
  static async getPopularProducts(
    limit: number = DEFAULT_VALUES.POPULAR_PRODUCTS_LIMIT,
    categoryId?: string
  ): Promise<IProduct[]> {
    let query = this.db(this.getTableName())
      .where('is_active', true)
      .orderBy('popularity_score', 'desc')
      .limit(limit);

    if (categoryId) {
      query = query.where('category_id', categoryId);
    }

    return query;
  }

  // Get recently released products
  static async getRecentProducts(
    limit: number = DEFAULT_VALUES.RECENT_PRODUCTS_LIMIT,
    categoryId?: string
  ): Promise<IProduct[]> {
    let query = this.db(this.getTableName())
      .where('is_active', true)
      .whereNotNull('release_date')
      .orderBy('release_date', 'desc')
      .limit(limit);

    if (categoryId) {
      query = query.where('category_id', categoryId);
    }

    return query;
  }

  // Get upcoming products
  static async getUpcomingProducts(
    limit: number = DEFAULT_VALUES.UPCOMING_PRODUCTS_LIMIT,
    categoryId?: string
  ): Promise<IProduct[]> {
    const now = new Date();

    let query = this.db(this.getTableName())
      .where('is_active', true)
      .where('release_date', '>', now)
      .orderBy('release_date', 'asc')
      .limit(limit);

    if (categoryId) {
      query = query.where('category_id', categoryId);
    }

    return query;
  }

  // Advanced search with filters including retailer and price
  static async searchWithFilters(
    searchTerm: string,
    options: {
      category_id?: string;
      set_name?: string;
      series?: string;
      retailer_id?: string;
      min_price?: number;
      max_price?: number;
      availability?: string;
      is_active?: boolean;
      page?: number;
      limit?: number;
      sort_by?: string;
      sort_order?: string;
    } = {}
  ): Promise<IPaginatedResult<IProduct & { availability?: IProductAvailability }>> {
    try {
      const {
        category_id,
        set_name,
        series,
        retailer_id,
        min_price,
        max_price,
        availability,
        is_active = true,
        page = DEFAULT_VALUES.DEFAULT_PAGE,
        limit = DEFAULT_VALUES.DEFAULT_LIMIT,
        sort_by = 'popularity_score',
        sort_order = 'desc'
      } = options;

      let query = this.db(this.getTableName())
        .select(`${this.getTableName()}.*`)
        .where(`${this.getTableName()}.is_active`, is_active);

      // Join with availability if retailer or price filters are specified
      if (retailer_id || min_price !== undefined || max_price !== undefined || availability) {
        query = query
          .leftJoin('product_availability', `${this.getTableName()}.id`, 'product_availability.product_id')
          .select(`${this.getTableName()}.*`, 
            'product_availability.price',
            'product_availability.in_stock',
            'product_availability.availability_status'
          );

        if (retailer_id) {
          query = query.where('product_availability.retailer_id', retailer_id);
        }
        if (min_price !== undefined) {
          query = query.where('product_availability.price', '>=', min_price);
        }
        if (max_price !== undefined) {
          query = query.where('product_availability.price', '<=', max_price);
        }
        if (availability) {
          query = query.where('product_availability.availability_status', availability);
        }
      }

      // Add search term filtering
      if (searchTerm) {
        query = query.where(function () {
          this.where(`${Product.getTableName()}.name`, 'ILIKE', `%${searchTerm}%`)
            .orWhere(`${Product.getTableName()}.description`, 'ILIKE', `%${searchTerm}%`)
            .orWhere(`${Product.getTableName()}.set_name`, 'ILIKE', `%${searchTerm}%`)
            .orWhere(`${Product.getTableName()}.series`, 'ILIKE', `%${searchTerm}%`)
            .orWhere(`${Product.getTableName()}.sku`, 'ILIKE', `%${searchTerm}%`);
        });
      }

      // Add other filters
      if (category_id) {
        query = query.where(`${this.getTableName()}.category_id`, category_id);
      }
      if (set_name) {
        query = query.where(`${this.getTableName()}.set_name`, 'ILIKE', `%${set_name}%`);
      }
      if (series) {
        query = query.where(`${this.getTableName()}.series`, 'ILIKE', `%${series}%`);
      }

      // Add sorting
      const validSortFields = ['name', 'release_date', 'popularity_score', 'created_at'];
      const sortField = validSortFields.includes(sort_by) ? sort_by : 'popularity_score';
      const sortDirection = sort_order === 'asc' ? 'asc' : 'desc';
      
      query = query.orderBy(`${this.getTableName()}.${sortField}`, sortDirection);

      // Remove the condition that prevents showing all products when no filters are applied
      // This allows the product catalog to display all products by default
      
      return this.getPaginatedResults<IProduct>(query, page, limit);
    } catch (error) {
      logger.error(`Error searching products with filters:`, error);
      throw handleDatabaseError(error);
    }
  }

  /**
   * Private helper method to build the product with availability query
   * @private
   */
  private static buildProductWithAvailabilityQuery() {
    const tableName = this.getTableName();
    const { PRODUCT_AVAILABILITY_TABLE, RETAILERS_TABLE, AVAILABILITY_ID_ALIAS, RETAILER_NAME_ALIAS, RETAILER_SLUG_ALIAS } = DATABASE_CONSTANTS;
    
    return this.db(tableName)
      .select(
        `${tableName}.*`,
        `${PRODUCT_AVAILABILITY_TABLE}.id as ${AVAILABILITY_ID_ALIAS}`,
        `${PRODUCT_AVAILABILITY_TABLE}.retailer_id`,
        `${PRODUCT_AVAILABILITY_TABLE}.price`,
        `${PRODUCT_AVAILABILITY_TABLE}.in_stock`,
        `${PRODUCT_AVAILABILITY_TABLE}.availability_status`,
        `${PRODUCT_AVAILABILITY_TABLE}.product_url`,
        `${PRODUCT_AVAILABILITY_TABLE}.cart_url`,
        `${PRODUCT_AVAILABILITY_TABLE}.last_checked`,
        `${PRODUCT_AVAILABILITY_TABLE}.store_locations`,
        `${RETAILERS_TABLE}.name as ${RETAILER_NAME_ALIAS}`,
        `${RETAILERS_TABLE}.slug as ${RETAILER_SLUG_ALIAS}`
      )
      .leftJoin(PRODUCT_AVAILABILITY_TABLE, `${tableName}.id`, `${PRODUCT_AVAILABILITY_TABLE}.product_id`)
      .leftJoin(RETAILERS_TABLE, `${PRODUCT_AVAILABILITY_TABLE}.retailer_id`, `${RETAILERS_TABLE}.id`)
      .where(function() {
        this.where(`${RETAILERS_TABLE}.is_active`, true).orWhereNull(`${RETAILERS_TABLE}.id`);
      })
      .orderBy(`${PRODUCT_AVAILABILITY_TABLE}.last_checked`, 'desc');
  }

  /**
   * Private helper method to process query results into product with availability format
   * @private
   */
  private static processProductWithAvailabilityResults(results: any[]): IProductWithAvailability | null {
    if (results.length === 0) return null;

    // Extract product data from first result
    const productData = results[0];
    const product: IProduct = {
      id: productData.id,
      name: productData.name,
      slug: productData.slug,
      sku: productData.sku,
      upc: productData.upc,
      category_id: productData.category_id,
      set_name: productData.set_name,
      series: productData.series,
      release_date: productData.release_date,
      msrp: productData.msrp,
      image_url: productData.image_url,
      description: productData.description,
      metadata: productData.metadata,
      is_active: productData.is_active,
      popularity_score: productData.popularity_score,
      created_at: productData.created_at,
      updated_at: productData.updated_at
    };

    // Build availability array from results, filtering out null availability records
    const { AVAILABILITY_ID_ALIAS, RETAILER_NAME_ALIAS, RETAILER_SLUG_ALIAS } = DATABASE_CONSTANTS;
    const availability: IProductAvailability[] = results
      .filter(row => row[AVAILABILITY_ID_ALIAS] !== null)
      .map(row => ({
        id: row[AVAILABILITY_ID_ALIAS],
        product_id: row.id,
        retailer_id: row.retailer_id,
        price: row.price,
        in_stock: row.in_stock,
        availability_status: row.availability_status,
        url: row.product_url,
        cart_url: row.cart_url,
        last_checked: row.last_checked,
        store_locations: row.store_locations,
        retailer_name: row[RETAILER_NAME_ALIAS],
        retailer_slug: row[RETAILER_SLUG_ALIAS]
      }));

    return {
      ...product,
      availability
    };
  }

  // Get product with availability information using a single JOIN query
  static async getProductWithAvailability(productId: string): Promise<IProductWithAvailability | null> {
    // Input validation
    if (!productId || typeof productId !== 'string' || productId.trim().length === 0) {
      throw new Error('Valid productId is required');
    }

    try {
      const results = await this.buildProductWithAvailabilityQuery()
        .where(`${this.getTableName()}.id`, productId.trim());

      return this.processProductWithAvailabilityResults(results);
    } catch (error) {
      logger.error(`Error getting product with availability:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Get product by slug with availability information using a single JOIN query
  static async getProductWithAvailabilityBySlug(slug: string): Promise<IProductWithAvailability | null> {
    // Input validation
    if (!slug || typeof slug !== 'string' || slug.trim().length === 0) {
      throw new Error('Valid slug is required');
    }

    try {
      const normalizedSlug = slug.trim().toLowerCase();
      const results = await this.buildProductWithAvailabilityQuery()
        .where(`${this.getTableName()}.slug`, normalizedSlug);

      return this.processProductWithAvailabilityResults(results);
    } catch (error) {
      logger.error(`Error getting product with availability by slug:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Get price history for a product
  static async getPriceHistory(
    productId: string, 
    days: number = NUMERIC_LIMITS.PRICE_HISTORY_DEFAULT_DAYS, 
    retailerId?: string
  ): Promise<any[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      let query = this.db('price_history')
        .select(
          'price_history.*',
          'retailers.name as retailer_name',
          'retailers.slug as retailer_slug'
        )
        .leftJoin('retailers', 'price_history.retailer_id', 'retailers.id')
        .where('price_history.product_id', productId)
        .where('price_history.recorded_at', '>=', startDate)
        .orderBy('price_history.recorded_at', 'asc');

      if (retailerId) {
        query = query.where('price_history.retailer_id', retailerId);
      }

      return query;
    } catch (error) {
      logger.error(`Error getting price history:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Get product statistics
  static async getProductStats(): Promise<{
    total: number;
    active: number;
    byCategory: Record<string, number>;
    bySeries: Record<string, number>;
  }> {
    const totalResults = await this.db(this.getTableName()).count('* as count');
    const activeResults = await this.db(this.getTableName())
      .where('is_active', true)
      .count('* as count');

    // Get counts by category (would need to join with categories table for names)
    const categoryStats = await this.db(this.getTableName())
      .select('category_id')
      .count('* as count')
      .whereNotNull('category_id')
      .groupBy('category_id');

    // Get counts by series
    const seriesStats = await this.db(this.getTableName())
      .select('series')
      .count('* as count')
      .whereNotNull('series')
      .groupBy('series');

    return {
      total: safeCount(totalResults),
      active: safeCount(activeResults),
      byCategory: safeStatsMap(categoryStats, 'category_id'),
      bySeries: safeStatsMap(seriesStats, 'series')
    };
  }
}
