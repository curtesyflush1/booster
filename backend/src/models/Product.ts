import { BaseModel } from './BaseModel';
import { IProduct, IValidationError, IPaginatedResult } from '../types/database';
import { safeCount, safeStatsMap } from '../utils/database';
import { handleDatabaseError } from '../config/database';
import { logger } from '../utils/logger';

export class Product extends BaseModel<IProduct> {
  protected static override tableName = 'products';

  // Validation rules for product data
  validate(data: Partial<IProduct>): IValidationError[] {
    const errors: IValidationError[] = [];

    // Name validation
    if (data.name !== undefined) {
      const nameError = Product.validateRequired(data.name, 'name') ||
        Product.validateLength(data.name, 'name', 1, 255);
      if (nameError) errors.push(nameError);
    }

    // Slug validation
    if (data.slug !== undefined) {
      const slugError = Product.validateRequired(data.slug, 'slug') ||
        Product.validateLength(data.slug, 'slug', 1, 255);
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
      const skuError = Product.validateLength(data.sku, 'sku', 1, 100);
      if (skuError) errors.push(skuError);
    }

    // UPC validation
    if (data.upc !== undefined && data.upc !== null) {
      const upcError = Product.validateLength(data.upc, 'upc', 8, 14);
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
      const msrpError = Product.validateNumeric(data.msrp, 'msrp', 0, 999999.99);
      if (msrpError) errors.push(msrpError);
    }

    // Set name validation
    if (data.set_name !== undefined && data.set_name !== null) {
      const setError = Product.validateLength(data.set_name, 'set_name', 1, 255);
      if (setError) errors.push(setError);
    }

    // Series validation
    if (data.series !== undefined && data.series !== null) {
      const seriesError = Product.validateLength(data.series, 'series', 1, 255);
      if (seriesError) errors.push(seriesError);
    }

    // Image URL validation
    if (data.image_url !== undefined && data.image_url !== null) {
      const urlError = Product.validateLength(data.image_url, 'image_url', 1, 500);
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
      const popularityError = Product.validateNumeric(data.popularity_score, 'popularity_score', 0, 1000);
      if (popularityError) errors.push(popularityError);
    }

    return errors;
  }

  // Sanitize product input
  sanitize(data: Partial<IProduct>): Partial<IProduct> {
    const sanitized: Partial<IProduct> = { ...data };

    // Trim string fields
    if (sanitized.name) {
      sanitized.name = sanitized.name.trim();
    }
    if (sanitized.slug) {
      sanitized.slug = sanitized.slug.trim().toLowerCase();
    }
    if (sanitized.sku) {
      sanitized.sku = sanitized.sku.trim().toUpperCase();
    }
    if (sanitized.upc) {
      sanitized.upc = sanitized.upc.trim();
    }
    if (sanitized.set_name) {
      sanitized.set_name = sanitized.set_name.trim();
    }
    if (sanitized.series) {
      sanitized.series = sanitized.series.trim();
    }
    if (sanitized.image_url) {
      sanitized.image_url = sanitized.image_url.trim();
    }
    if (sanitized.description) {
      sanitized.description = sanitized.description.trim();
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

  // Find product by UPC
  static async findByUPC(upc: string): Promise<IProduct | null> {
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
        page = 1,
        limit = 20
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
      const { is_active = true, page = 1, limit = 20 } = options;

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

  // Get products by set
  static async findBySet(setName: string): Promise<IProduct[]> {
    return this.findBy<IProduct>({
      set_name: setName,
      is_active: true
    });
  }

  // Update popularity score
  static async updatePopularityScore(productId: string, score: number): Promise<boolean> {
    const updated = await this.updateById<IProduct>(productId, {
      popularity_score: Math.max(0, Math.min(1000, score))
    });
    return updated !== null;
  }

  // Increment popularity score
  static async incrementPopularity(productId: string, increment: number = 1): Promise<boolean> {
    const product = await this.findById<IProduct>(productId);
    if (!product) return false;

    const newScore = Math.min(1000, product.popularity_score + increment);
    return this.updatePopularityScore(productId, newScore);
  }

  // Get popular products
  static async getPopularProducts(
    limit: number = 10,
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
    limit: number = 10,
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
    limit: number = 10,
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