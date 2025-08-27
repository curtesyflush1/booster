import { BaseModel } from './BaseModel';
import { IWatchPack, IValidationError, IPaginatedResult } from '../types/database';
import { handleDatabaseError } from '../config/database';
import { logger } from '../utils/logger';

export class WatchPack extends BaseModel<IWatchPack> {
  protected static override tableName = 'watch_packs';

  // Validation rules for watch pack data
  validate(data: Partial<IWatchPack>): IValidationError[] {
    const errors: IValidationError[] = [];

    // Name validation
    if (data.name !== undefined) {
      const nameError = WatchPack.validateRequired(data.name, 'name');
      if (nameError) errors.push(nameError);
      else {
        const lengthError = WatchPack.validateLength(data.name, 'name', 1, 100);
        if (lengthError) errors.push(lengthError);
      }
    }

    // Slug validation
    if (data.slug !== undefined) {
      const slugError = WatchPack.validateRequired(data.slug, 'slug');
      if (slugError) errors.push(slugError);
      else {
        // Validate slug format (lowercase, hyphens, alphanumeric)
        if (!/^[a-z0-9-]+$/.test(data.slug)) {
          errors.push({
            field: 'slug',
            message: 'Slug must contain only lowercase letters, numbers, and hyphens',
            value: data.slug
          });
        }
        const lengthError = WatchPack.validateLength(data.slug, 'slug', 1, 100);
        if (lengthError) errors.push(lengthError);
      }
    }

    // Product IDs validation
    if (data.product_ids !== undefined) {
      if (!Array.isArray(data.product_ids)) {
        errors.push({
          field: 'product_ids',
          message: 'Product IDs must be an array',
          value: data.product_ids
        });
      } else if (data.product_ids.length === 0) {
        errors.push({
          field: 'product_ids',
          message: 'At least one product ID is required',
          value: data.product_ids
        });
      } else {
        // Validate each product ID format
        data.product_ids.forEach((id, index) => {
          if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
            errors.push({
              field: `product_ids[${index}]`,
              message: 'Invalid UUID format',
              value: id
            });
          }
        });
      }
    }

    // Description validation
    if (data.description !== undefined && data.description !== null) {
      const descError = WatchPack.validateLength(data.description, 'description', 0, 1000);
      if (descError) errors.push(descError);
    }

    // Subscriber count validation
    if (data.subscriber_count !== undefined) {
      const countError = WatchPack.validateNumeric(data.subscriber_count, 'subscriber_count', 0);
      if (countError) errors.push(countError);
    }

    return errors;
  }

  // Sanitize watch pack input
  sanitize(data: Partial<IWatchPack>): Partial<IWatchPack> {
    const sanitized: Partial<IWatchPack> = { ...data };

    // Trim string fields
    if (sanitized.name) {
      sanitized.name = sanitized.name.trim();
    }
    if (sanitized.slug) {
      sanitized.slug = sanitized.slug.trim().toLowerCase();
    }
    if (sanitized.description) {
      sanitized.description = sanitized.description.trim();
    }

    // Ensure product_ids is an array
    if (!Array.isArray(sanitized.product_ids)) {
      sanitized.product_ids = [];
    }

    // Set default values
    if (sanitized.is_active === undefined) {
      sanitized.is_active = true;
    }
    if (sanitized.auto_update === undefined) {
      sanitized.auto_update = true;
    }
    if (sanitized.subscriber_count === undefined) {
      sanitized.subscriber_count = 0;
    }

    return sanitized;
  }

  // Create watch pack with validation
  static async createWatchPack(packData: Partial<IWatchPack>): Promise<IWatchPack> {
    const pack = new WatchPack();
    const sanitizedData = pack.sanitize(packData);

    // Validate the data
    const errors = pack.validate(sanitizedData);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
    }

    // Check for slug uniqueness
    if (sanitizedData.slug) {
      const existing = await this.findOneBy<IWatchPack>({ slug: sanitizedData.slug });
      if (existing) {
        throw new Error('A watch pack with this slug already exists');
      }
    }

    return this.create<IWatchPack>(sanitizedData);
  }

  // Find watch pack by slug
  static async findBySlug(slug: string): Promise<IWatchPack | null> {
    return this.findOneBy<IWatchPack>({ slug });
  }

  // Get all active watch packs
  static async getActiveWatchPacks(
    options: {
      page?: number;
      limit?: number;
      search?: string;
    } = {}
  ): Promise<IPaginatedResult<IWatchPack>> {
    try {
      const { page = 1, limit = 20, search } = options;

      let query = this.db(this.getTableName())
        .where('is_active', true);

      // Add search functionality
      if (search) {
        query = query.where(function() {
          this.where('name', 'ilike', `%${search}%`)
            .orWhere('description', 'ilike', `%${search}%`);
        });
      }

      return this.getPaginatedResults<IWatchPack>(query, page, limit, 'subscriber_count', 'desc');
    } catch (error) {
      logger.error(`Error getting active watch packs:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Get popular watch packs (by subscriber count)
  static async getPopularWatchPacks(limit: number = 10): Promise<IWatchPack[]> {
    return this.db(this.getTableName())
      .where('is_active', true)
      .orderBy('subscriber_count', 'desc')
      .limit(limit);
  }

  // Add product to watch pack
  static async addProduct(packId: string, productId: string): Promise<boolean> {
    try {
      const pack = await this.findById<IWatchPack>(packId);
      if (!pack) return false;

      // Check if product is already in the pack
      if (pack.product_ids.includes(productId)) {
        return true; // Already exists, consider it success
      }

      const updatedProductIds = [...pack.product_ids, productId];
      const updated = await this.updateById<IWatchPack>(packId, {
        product_ids: updatedProductIds
      });

      return updated !== null;
    } catch (error) {
      logger.error(`Error adding product to watch pack:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Remove product from watch pack
  static async removeProduct(packId: string, productId: string): Promise<boolean> {
    try {
      const pack = await this.findById<IWatchPack>(packId);
      if (!pack) return false;

      const updatedProductIds = pack.product_ids.filter(id => id !== productId);
      const updated = await this.updateById<IWatchPack>(packId, {
        product_ids: updatedProductIds
      });

      return updated !== null;
    } catch (error) {
      logger.error(`Error removing product from watch pack:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Update subscriber count
  static async updateSubscriberCount(packId: string, increment: number = 1): Promise<boolean> {
    try {
      const pack = await this.findById<IWatchPack>(packId);
      if (!pack) return false;

      const newCount = Math.max(0, pack.subscriber_count + increment);
      const updated = await this.updateById<IWatchPack>(packId, {
        subscriber_count: newCount
      });

      return updated !== null;
    } catch (error) {
      logger.error(`Error updating subscriber count:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Get watch packs that need auto-updates
  static async getPacksForAutoUpdate(): Promise<IWatchPack[]> {
    return this.findBy<IWatchPack>({
      is_active: true,
      auto_update: true
    });
  }

  // Update watch pack with new products based on criteria
  static async autoUpdatePack(packId: string, newProductIds: string[]): Promise<boolean> {
    try {
      const pack = await this.findById<IWatchPack>(packId);
      if (!pack || !pack.auto_update) return false;

      // Merge existing and new product IDs, removing duplicates
      const allProductIds = [...new Set([...pack.product_ids, ...newProductIds])];

      const updated = await this.updateById<IWatchPack>(packId, {
        product_ids: allProductIds
      });

      if (updated) {
        logger.info(`Auto-updated watch pack ${packId} with ${newProductIds.length} new products`);
      }

      return updated !== null;
    } catch (error) {
      logger.error(`Error auto-updating watch pack:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Get watch pack statistics
  static async getWatchPackStats(packId: string): Promise<{
    productCount: number;
    subscriberCount: number;
    isActive: boolean;
    autoUpdate: boolean;
    createdAt: Date;
  } | null> {
    try {
      const pack = await this.findById<IWatchPack>(packId);
      if (!pack) return null;

      return {
        productCount: pack.product_ids.length,
        subscriberCount: pack.subscriber_count,
        isActive: pack.is_active,
        autoUpdate: pack.auto_update,
        createdAt: pack.created_at
      };
    } catch (error) {
      logger.error(`Error getting watch pack stats:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Search watch packs by product
  static async findPacksContainingProduct(productId: string): Promise<IWatchPack[]> {
    return this.db(this.getTableName())
      .where('is_active', true)
      .whereRaw('? = ANY(product_ids)', [productId]);
  }

  // Get system-wide watch pack statistics
  static async getSystemWatchPackStats(): Promise<{
    totalPacks: number;
    activePacks: number;
    totalSubscribers: number;
    avgProductsPerPack: number;
    avgSubscribersPerPack: number;
  }> {
    try {
      const totalResult = await this.db(this.getTableName()).count('* as count');
      const activeResult = await this.db(this.getTableName())
        .where('is_active', true)
        .count('* as count');

      const subscriberResult = await this.db(this.getTableName())
        .sum('subscriber_count as total_subscribers');

      const avgProductsResult = await this.db(this.getTableName())
        .where('is_active', true)
        .select(this.db.raw('AVG(jsonb_array_length(product_ids)) as avg_products'));

      const avgSubscribersResult = await this.db(this.getTableName())
        .where('is_active', true)
        .avg('subscriber_count as avg_subscribers');

      const totalPacks = Number(totalResult[0]?.count || 0);
      const activePacks = Number(activeResult[0]?.count || 0);

      return {
        totalPacks,
        activePacks,
        totalSubscribers: Number(subscriberResult[0]?.total_subscribers || 0),
        avgProductsPerPack: Math.round(Number(avgProductsResult[0]?.avg_products || 0) * 100) / 100,
        avgSubscribersPerPack: Math.round(Number(avgSubscribersResult[0]?.avg_subscribers || 0) * 100) / 100
      };
    } catch (error) {
      logger.error(`Error getting system watch pack statistics:`, error);
      throw handleDatabaseError(error);
    }
  }
}