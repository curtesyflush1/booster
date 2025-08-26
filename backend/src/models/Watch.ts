import { BaseModel } from './BaseModel';
import { IWatch, IValidationError, IPaginatedResult } from '../types/database';
import { safeCount, safeSum } from '../utils/database';
import { handleDatabaseError } from '../config/database';
import { logger } from '../utils/logger';

export class Watch extends BaseModel<IWatch> {
  protected static override tableName = 'watches';

  // Validation rules for watch data
  validate(data: Partial<IWatch>): IValidationError[] {
    const errors: IValidationError[] = [];

    // User ID validation
    if (data.user_id !== undefined) {
      const userIdError = Watch.validateRequired(data.user_id, 'user_id');
      if (userIdError) errors.push(userIdError);
    }

    // Product ID validation
    if (data.product_id !== undefined) {
      const productIdError = Watch.validateRequired(data.product_id, 'product_id');
      if (productIdError) errors.push(productIdError);
    }

    // Max price validation
    if (data.max_price !== undefined && data.max_price !== null) {
      const priceError = Watch.validateNumeric(data.max_price, 'max_price', 0, 999999.99);
      if (priceError) errors.push(priceError);
    }

    // Availability type validation
    if (data.availability_type !== undefined) {
      const availabilityError = Watch.validateEnum(
        data.availability_type,
        'availability_type',
        ['online', 'in_store', 'both']
      );
      if (availabilityError) errors.push(availabilityError);
    }

    // ZIP code validation
    if (data.zip_code !== undefined && data.zip_code !== null) {
      const zipError = Watch.validateLength(data.zip_code, 'zip_code', 5, 10);
      if (zipError) errors.push(zipError);

      // Basic ZIP code format validation (US format)
      if (data.zip_code && !/^\d{5}(-\d{4})?$/.test(data.zip_code)) {
        errors.push({
          field: 'zip_code',
          message: 'ZIP code must be in format 12345 or 12345-6789',
          value: data.zip_code
        });
      }
    }

    // Radius validation
    if (data.radius_miles !== undefined && data.radius_miles !== null) {
      const radiusError = Watch.validateNumeric(data.radius_miles, 'radius_miles', 1, 500);
      if (radiusError) errors.push(radiusError);
    }

    // Alert count validation
    if (data.alert_count !== undefined) {
      const countError = Watch.validateNumeric(data.alert_count, 'alert_count', 0);
      if (countError) errors.push(countError);
    }

    return errors;
  }

  // Sanitize watch input
  sanitize(data: Partial<IWatch>): Partial<IWatch> {
    const sanitized: Partial<IWatch> = { ...data };

    // Trim ZIP code
    if (sanitized.zip_code) {
      sanitized.zip_code = sanitized.zip_code.trim();
    }

    // Ensure retailer_ids is an array
    if (!Array.isArray(sanitized.retailer_ids)) {
      sanitized.retailer_ids = [];
    }

    // Ensure alert_preferences is an object
    if (!sanitized.alert_preferences) {
      sanitized.alert_preferences = {};
    }

    // Set default values
    if (sanitized.is_active === undefined) {
      sanitized.is_active = true;
    }
    if (sanitized.alert_count === undefined) {
      sanitized.alert_count = 0;
    }
    if (sanitized.availability_type === undefined) {
      sanitized.availability_type = 'both';
    }

    return sanitized;
  }

  // Create watch with validation
  static async createWatch(watchData: Partial<IWatch>): Promise<IWatch> {
    const watch = new Watch();
    const sanitizedData = watch.sanitize(watchData);

    // Validate the data
    const errors = watch.validate(sanitizedData);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
    }

    return this.create<IWatch>(sanitizedData);
  }

  // Find watches by user ID
  static async findByUserId(
    userId: string,
    options: {
      is_active?: boolean;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<IPaginatedResult<IWatch>> {
    try {
      const { is_active = true, page = 1, limit = 20 } = options;

      let query = this.db(this.getTableName())
        .where('user_id', userId);

      if (is_active !== undefined) {
        query = query.where('is_active', is_active);
      }

      return this.getPaginatedResults<IWatch>(query, page, limit, 'created_at', 'desc');
    } catch (error) {
      logger.error(`Error finding watches by user:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Find watches by product ID
  static async findByProductId(productId: string, isActive: boolean = true): Promise<IWatch[]> {
    return this.findBy<IWatch>({
      product_id: productId,
      is_active: isActive
    });
  }

  // Find user's watch for a specific product
  static async findUserProductWatch(userId: string, productId: string): Promise<IWatch | null> {
    return this.findOneBy<IWatch>({
      user_id: userId,
      product_id: productId
    });
  }

  // Get watches that need to be checked
  static async getWatchesForMonitoring(
    retailerId?: string,
    limit: number = 100
  ): Promise<IWatch[]> {
    let query = this.db(this.getTableName())
      .where('is_active', true);

    // Filter by retailer if specified
    if (retailerId) {
      query = query.whereRaw('? = ANY(retailer_ids)', [retailerId]);
    }

    // Order by last alerted (oldest first) to ensure fair distribution
    return query
      .orderBy('last_alerted', 'asc')
      .limit(limit);
  }

  // Update watch alert information
  static async updateAlertInfo(
    watchId: string,
    alertedAt: Date = new Date()
  ): Promise<boolean> {
    const watch = await this.findById<IWatch>(watchId);
    if (!watch) return false;

    const updated = await this.updateById<IWatch>(watchId, {
      last_alerted: alertedAt,
      alert_count: watch.alert_count + 1
    });
    return updated !== null;
  }

  // Toggle watch active status
  static async toggleActive(watchId: string): Promise<boolean> {
    const watch = await this.findById<IWatch>(watchId);
    if (!watch) return false;

    const updated = await this.updateById<IWatch>(watchId, {
      is_active: !watch.is_active
    });
    return updated !== null;
  }

  // Update watch preferences
  static async updatePreferences(
    watchId: string,
    preferences: Record<string, any>
  ): Promise<boolean> {
    const watch = await this.findById<IWatch>(watchId);
    if (!watch) return false;

    const updatedPreferences = { ...watch.alert_preferences, ...preferences };
    const updated = await this.updateById<IWatch>(watchId, {
      alert_preferences: updatedPreferences
    });
    return updated !== null;
  }

  // Update retailer list for a watch
  static async updateRetailers(watchId: string, retailerIds: string[]): Promise<boolean> {
    const updated = await this.updateById<IWatch>(watchId, {
      retailer_ids: retailerIds
    });
    return updated !== null;
  }

  // Get watch statistics for a user
  static async getUserWatchStats(userId: string): Promise<{
    total: number;
    active: number;
    totalAlerts: number;
    recentAlerts: number;
    topProducts: Array<{ product_id: string; alert_count: number }>;
  }> {
    try {
      const totalResult = await this.db(this.getTableName())
        .where('user_id', userId)
        .count('* as count');

      const activeResult = await this.db(this.getTableName())
        .where('user_id', userId)
        .where('is_active', true)
        .count('* as count');

      const alertsResult = await this.db(this.getTableName())
        .where('user_id', userId)
        .sum('alert_count as total_alerts');

      // Get recent alerts (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentAlertsResult = await this.db(this.getTableName())
        .where('user_id', userId)
        .where('last_alerted', '>=', sevenDaysAgo)
        .count('* as count');

      // Get top products by alert count
      const topProducts = await this.db(this.getTableName())
        .select('product_id', 'alert_count')
        .where('user_id', userId)
        .where('alert_count', '>', 0)
        .orderBy('alert_count', 'desc')
        .limit(5);

      return {
        total: safeCount(totalResult),
        active: safeCount(activeResult),
        totalAlerts: safeSum(alertsResult, 'total_alerts'),
        recentAlerts: safeCount(recentAlertsResult),
        topProducts: topProducts.map(p => ({
          product_id: String(p.product_id),
          alert_count: Number(p.alert_count)
        }))
      };
    } catch (error) {
      logger.error(`Error getting user watch statistics:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Get system-wide watch statistics
  static async getSystemWatchStats(): Promise<{
    totalWatches: number;
    activeWatches: number;
    totalUsers: number;
    avgWatchesPerUser: number;
    topProducts: Array<{ product_id: string; watch_count: number }>;
  }> {
    const totalResult = await this.db(this.getTableName()).count('* as count');
    const activeResult = await this.db(this.getTableName())
      .where('is_active', true)
      .count('* as count');

    const usersResult = await this.db(this.getTableName())
      .countDistinct('user_id as count');

    // Get top watched products
    const topProducts = await this.db(this.getTableName())
      .select('product_id')
      .count('* as watch_count')
      .where('is_active', true)
      .groupBy('product_id')
      .orderBy('watch_count', 'desc')
      .limit(10);

    const totalWatches = safeCount(totalResult);
    const totalUsers = safeCount(usersResult);

    return {
      totalWatches,
      activeWatches: safeCount(activeResult),
      totalUsers,
      avgWatchesPerUser: totalUsers > 0 ? Math.round(totalWatches / totalUsers * 100) / 100 : 0,
      topProducts: topProducts.map(p => ({
        product_id: String(p.product_id),
        watch_count: Number(p.watch_count)
      }))
    };
  }

  // Bulk create watches (for Watch Packs)
  static async bulkCreateWatches(
    userId: string,
    productIds: string[],
    watchData: Partial<IWatch> = {}
  ): Promise<IWatch[]> {
    const watches = productIds.map(productId => ({
      user_id: userId,
      product_id: productId,
      ...watchData
    }));

    const watch = new Watch();
    const sanitizedWatches = watches.map(w => watch.sanitize(w));

    // Validate all watches
    for (const watchData of sanitizedWatches) {
      const errors = watch.validate(watchData);
      if (errors.length > 0) {
        throw new Error(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
      }
    }

    return this.bulkCreate<IWatch>(sanitizedWatches);
  }

  // Remove watches for products that are no longer active
  static async cleanupInactiveProductWatches(): Promise<number> {
    const count = await this.db(this.getTableName())
      .whereIn('product_id', function () {
        this.select('id')
          .from('products')
          .where('is_active', false);
      })
      .update({ is_active: false });

    return count;
  }
}