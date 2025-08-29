import { BaseModel } from './BaseModel';
import { IAlert, IValidationError, IPaginatedResult } from '../types/database';

// Internal types for database query results
interface IUserStatsQueryResult {
  total_count: string | number;
  unread_count: string | number;
  recent_count: string | number;
  sent_count: string | number;
  clicked_count: string | number;
  type_counts: string | Record<string, any>;
  status_counts: string | Record<string, any>;
}
import { safeCount, safeStatsMap } from '../utils/database';
import { handleDatabaseError } from '../config/database';
import { logger } from '../utils/logger';
import { withCache } from '../utils/cache';
import { INTERVALS, VALIDATION_LIMITS, DEFAULT_VALUES, TIME_PERIODS } from '../constants';

export class Alert extends BaseModel<IAlert> {
  protected static override tableName = 'alerts';

  // Validation rules for alert data
  validate(data: Partial<IAlert>): IValidationError[] {
    const errors: IValidationError[] = [];

    // User ID validation
    if (data.user_id !== undefined) {
      const userIdError = Alert.validateRequired(data.user_id, 'user_id');
      if (userIdError) errors.push(userIdError);
    }

    // Product ID validation
    if (data.product_id !== undefined) {
      const productIdError = Alert.validateRequired(data.product_id, 'product_id');
      if (productIdError) errors.push(productIdError);
    }

    // Retailer ID validation
    if (data.retailer_id !== undefined) {
      const retailerIdError = Alert.validateRequired(data.retailer_id, 'retailer_id');
      if (retailerIdError) errors.push(retailerIdError);
    }

    // Type validation
    if (data.type !== undefined) {
      const typeError = Alert.validateEnum(
        data.type,
        'type',
        ['restock', 'price_drop', 'low_stock', 'pre_order']
      );
      if (typeError) errors.push(typeError);
    }

    // Priority validation
    if (data.priority !== undefined) {
      const priorityError = Alert.validateEnum(
        data.priority,
        'priority',
        ['low', 'medium', 'high', 'urgent']
      );
      if (priorityError) errors.push(priorityError);
    }

    // Status validation
    if (data.status !== undefined) {
      const statusError = Alert.validateEnum(
        data.status,
        'status',
        ['pending', 'sent', 'failed', 'read']
      );
      if (statusError) errors.push(statusError);
    }

    // Data validation
    if (data.data !== undefined) {
      const dataError = Alert.validateRequired(data.data, 'data');
      if (dataError) errors.push(dataError);
    }

    // Retry count validation
    if (data.retry_count !== undefined) {
      const retryError = Alert.validateNumeric(data.retry_count, 'retry_count', VALIDATION_LIMITS.MIN_RETRY_COUNT, VALIDATION_LIMITS.MAX_RETRY_COUNT);
      if (retryError) errors.push(retryError);
    }

    return errors;
  }

  // Sanitize alert input
  sanitize(data: Partial<IAlert>): Partial<IAlert> {
    const sanitized: Partial<IAlert> = { ...data };

    // Ensure delivery_channels is an array
    if (!Array.isArray(sanitized.delivery_channels)) {
      sanitized.delivery_channels = [];
    }

    // Ensure data is an object
    if (!sanitized.data) {
      sanitized.data = {
        product_name: '',
        retailer_name: '',
        availability_status: '',
        product_url: ''
      };
    }

    // Set default values
    if (sanitized.status === undefined) {
      sanitized.status = 'pending';
    }
    if (sanitized.retry_count === undefined) {
      sanitized.retry_count = 0;
    }
    if (sanitized.priority === undefined) {
      sanitized.priority = 'medium';
    }

    // Trim failure reason
    if (sanitized.failure_reason) {
      sanitized.failure_reason = sanitized.failure_reason.trim();
    }

    return sanitized;
  }

  // Create alert with validation
  static async createAlert(alertData: Partial<IAlert>): Promise<IAlert> {
    const alert = new Alert();
    const sanitizedData = alert.sanitize(alertData);
    
    // Validate the data
    const errors = alert.validate(sanitizedData);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
    }

    return this.create<IAlert>(sanitizedData);
  }

  // Find alerts by user ID
  static async findByUserId(
    userId: string,
    options: {
      status?: string;
      type?: string;
      unread_only?: boolean;
      search?: string;
      start_date?: Date;
      end_date?: Date;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<IPaginatedResult<IAlert>> {
    try {
      const {
        status,
        type,
        unread_only = false,
        search,
        start_date,
        end_date,
        page = DEFAULT_VALUES.DEFAULT_PAGE,
        limit = DEFAULT_VALUES.DEFAULT_LIMIT
      } = options;

      let query = this.db(this.getTableName())
        .where('user_id', userId);

      // Add filters
      if (status) {
        query = query.where('status', status);
      }
      if (type) {
        query = query.where('type', type);
      }
      if (unread_only) {
        query = query.whereNull('read_at');
      }
      if (search) {
        query = query.where(function() {
          this.whereRaw("data->>'product_name' ILIKE ?", [`%${search}%`])
              .orWhereRaw("data->>'retailer_name' ILIKE ?", [`%${search}%`]);
        });
      }
      if (start_date) {
        query = query.where('created_at', '>=', start_date);
      }
      if (end_date) {
        query = query.where('created_at', '<=', end_date);
      }

      return this.getPaginatedResults<IAlert>(query, page, limit, 'created_at', 'desc');
    } catch (error) {
      logger.error(`Error finding alerts by user:`, error);
      throw handleDatabaseError(error);
    }
  }

  // Get pending alerts for processing
  static async getPendingAlerts(limit: number = DEFAULT_VALUES.DEFAULT_MONITORING_LIMIT): Promise<IAlert[]> {
    const now = new Date();
    
    return this.db(this.getTableName())
      .where('status', 'pending')
      .where(function() {
        this.whereNull('scheduled_for')
            .orWhere('scheduled_for', '<=', now);
      })
      .orderBy('priority', 'desc')
      .orderBy('created_at', 'asc')
      .limit(limit);
  }

  // Get failed alerts for retry
  static async getFailedAlertsForRetry(maxRetries: number = DEFAULT_VALUES.DEFAULT_MAX_FAILED_RETRIES): Promise<IAlert[]> {
    return this.db(this.getTableName())
      .where('status', 'failed')
      .where('retry_count', '<', maxRetries)
      .orderBy('created_at', 'asc')
      .limit(DEFAULT_VALUES.DEFAULT_FAILED_ALERTS_LIMIT);
  }

  // Mark alert as sent
  static async markAsSent(alertId: string, deliveryChannels: string[]): Promise<boolean> {
    const updated = await this.updateById<IAlert>(alertId, {
      status: 'sent',
      sent_at: new Date(),
      delivery_channels: deliveryChannels
    });
    return updated !== null;
  }

  // Mark alert as failed
  static async markAsFailed(
    alertId: string,
    failureReason: string,
    incrementRetry: boolean = true
  ): Promise<boolean> {
    const alert = await this.findById<IAlert>(alertId);
    if (!alert) return false;

    const updateData: Partial<IAlert> = {
      status: 'failed',
      failure_reason: failureReason
    };

    if (incrementRetry) {
      updateData.retry_count = alert.retry_count + 1;
    }

    const updated = await this.updateById<IAlert>(alertId, updateData);
    return updated !== null;
  }

  // Mark alert as read
  static async markAsRead(alertId: string): Promise<boolean> {
    const updated = await this.updateById<IAlert>(alertId, {
      read_at: new Date()
    });
    return updated !== null;
  }

  // Mark alert as clicked
  static async markAsClicked(alertId: string): Promise<boolean> {
    const updated = await this.updateById<IAlert>(alertId, {
      clicked_at: new Date()
    });
    return updated !== null;
  }

  // Bulk mark alerts as read
  static async bulkMarkAsRead(alertIds: string[]): Promise<number> {
    const count = await this.db(this.getTableName())
      .whereIn('id', alertIds)
      .whereNull('read_at')
      .update({
        read_at: new Date(),
        updated_at: new Date()
      });

    return count;
  }

  // Get alert statistics for a user (optimized with single query)
  // This method was optimized to use a single complex SQL query with CTEs and aggregations
  // instead of multiple separate queries, reducing database round trips from 6 to 1
  static async getUserAlertStats(userId: string): Promise<{
    total: number;
    unread: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    clickThroughRate: number;
    recentAlerts: number;
  }> {
    // Input validation
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      throw new Error('Valid userId is required');
    }

    try {
      const startTime = Date.now();
      const sevenDaysAgo = new Date(Date.now() - INTERVALS.RECENT_ALERTS_PERIOD);
      const result = await this.executeUserStatsQuery(userId.trim(), sevenDaysAgo);
      
      const queryTime = Date.now() - startTime;
      if (queryTime > 1000) {
        logger.warn(`Slow getUserAlertStats query for user ${userId}: ${queryTime}ms`);
      }

      const stats = result.rows?.[0];
      if (!stats || stats.total_count === 0) {
        logger.debug(`No alert stats found for user ${userId}`);
        return this.getEmptyUserStats();
      }

      return this.processUserStatsResult(stats, userId);
    } catch (error) {
      logger.error(`Error getting user alert stats for user ${userId}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId
      });
      throw handleDatabaseError(error);
    }
  }

  /**
   * Execute the optimized user stats query using CTEs for better performance
   * @private
   * @param userId - The user ID to get stats for
   * @param sevenDaysAgo - Date threshold for recent alerts calculation
   * @returns Promise resolving to database query result
   * @throws Database error if query fails
   */
  private static async executeUserStatsQuery(userId: string, sevenDaysAgo: Date) {
    return this.db.raw(`
      WITH base_stats AS (
        SELECT 
          COUNT(*) as total_count,
          COUNT(CASE WHEN read_at IS NULL THEN 1 END) as unread_count,
          COUNT(CASE WHEN created_at >= ? THEN 1 END) as recent_count,
          COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_count,
          COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) as clicked_count
        FROM ${this.getTableName()}
        WHERE user_id = ?
      ),
      type_stats AS (
        SELECT type, COUNT(*) as count
        FROM ${this.getTableName()}
        WHERE user_id = ?
        GROUP BY type
      ),
      status_stats AS (
        SELECT status, COUNT(*) as count
        FROM ${this.getTableName()}
        WHERE user_id = ?
        GROUP BY status
      )
      SELECT 
        bs.total_count,
        bs.unread_count,
        bs.recent_count,
        bs.sent_count,
        bs.clicked_count,
        COALESCE(
          json_object_agg(ts.type, ts.count) FILTER (WHERE ts.type IS NOT NULL),
          '{}'::json
        ) as type_counts,
        COALESCE(
          json_object_agg(ss.status, ss.count) FILTER (WHERE ss.status IS NOT NULL),
          '{}'::json
        ) as status_counts
      FROM base_stats bs
      LEFT JOIN type_stats ts ON true
      LEFT JOIN status_stats ss ON true
      GROUP BY bs.total_count, bs.unread_count, bs.recent_count, bs.sent_count, bs.clicked_count
    `, [sevenDaysAgo, userId, userId, userId]);
  }

  /**
   * Process the raw database result into the expected format
   * @private
   * @param stats - Raw database query result
   * @param userId - User ID for logging context
   * @returns Processed user stats object
   */
  private static processUserStatsResult(stats: IUserStatsQueryResult, userId: string) {
    const sentCount = parseInt(String(stats.sent_count)) || 0;
    const clickedCount = parseInt(String(stats.clicked_count)) || 0;
    const clickThroughRate = sentCount > 0 ? (clickedCount / sentCount) : 0;

    const { byType, byStatus } = this.parseJsonAggregations(stats, userId);

    return {
      total: parseInt(String(stats.total_count)) || 0,
      unread: parseInt(String(stats.unread_count)) || 0,
      byType,
      byStatus,
      clickThroughRate: Math.round(clickThroughRate * DEFAULT_VALUES.PERCENTAGE_PRECISION) / DEFAULT_VALUES.PERCENTAGE_PRECISION,
      recentAlerts: parseInt(String(stats.recent_count)) || 0
    };
  }

  /**
   * Parse JSON aggregations safely with error handling
   * @private
   * @param stats - Database result containing JSON aggregations
   * @param userId - User ID for logging context
   * @returns Object containing parsed byType and byStatus maps
   */
  private static parseJsonAggregations(stats: IUserStatsQueryResult, userId: string): {
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  } {
    let byType: Record<string, number> = {};
    let byStatus: Record<string, number> = {};

    try {
      const typeData = typeof stats.type_counts === 'string' 
        ? JSON.parse(stats.type_counts) 
        : stats.type_counts || {};
      
      const statusData = typeof stats.status_counts === 'string'
        ? JSON.parse(stats.status_counts)
        : stats.status_counts || {};

      // Convert string values to numbers
      byType = this.convertToNumberMap(typeData);
      byStatus = this.convertToNumberMap(statusData);
    } catch (parseError) {
      logger.warn(`Error parsing JSON aggregations for user ${userId}:`, parseError);
      // Fall back to empty objects if JSON parsing fails
      byType = {};
      byStatus = {};
    }

    return { byType, byStatus };
  }

  /**
   * Convert object values to numbers safely, handling various input types
   * @private
   * @param data - Object with potentially mixed value types
   * @returns Object with all values converted to numbers (0 for invalid values)
   */
  private static convertToNumberMap(data: Record<string, any>): Record<string, number> {
    const result: Record<string, number> = {};
    Object.entries(data).forEach(([key, value]) => {
      result[key] = parseInt(String(value)) || 0;
    });
    return result;
  }

  /**
   * Return empty stats structure for users with no alerts
   * @private
   * @returns Empty user stats object with zero values
   */
  private static getEmptyUserStats() {
    return {
      total: 0,
      unread: 0,
      byType: {},
      byStatus: {},
      clickThroughRate: 0,
      recentAlerts: 0
    };
  }

  // Get system-wide alert statistics (cached for 5 minutes)
  static async getSystemAlertStats(): Promise<{
    totalAlerts: number;
    pendingAlerts: number;
    failedAlerts: number;
    avgDeliveryTime: number;
    alertsByType: Record<string, number>;
    alertsByPriority: Record<string, number>;
  }> {
    return withCache('system_alert_stats', async () => {
    const totalResult = await this.db(this.getTableName()).count('* as count');
    const pendingResult = await this.db(this.getTableName())
      .where('status', 'pending')
      .count('* as count');
    const failedResult = await this.db(this.getTableName())
      .where('status', 'failed')
      .count('* as count');

    // Get average delivery time (for sent alerts)
    const deliveryTimes = await this.db(this.getTableName())
      .select(this.db.raw('EXTRACT(EPOCH FROM (sent_at - created_at)) as delivery_seconds'))
      .where('status', 'sent')
      .whereNotNull('sent_at');

    const avgDeliveryTime = deliveryTimes.length > 0
      ? deliveryTimes.reduce((sum, row) => sum + parseFloat((row as any).delivery_seconds), 0) / deliveryTimes.length
      : 0;

    // Get counts by type
    const typeStats = await this.db(this.getTableName())
      .select('type')
      .count('* as count')
      .groupBy('type');

    // Get counts by priority
    const priorityStats = await this.db(this.getTableName())
      .select('priority')
      .count('* as count')
      .groupBy('priority');

      return {
        totalAlerts: safeCount(totalResult),
        pendingAlerts: safeCount(pendingResult),
        failedAlerts: safeCount(failedResult),
        avgDeliveryTime: Math.round(avgDeliveryTime * DEFAULT_VALUES.PERCENTAGE_PRECISION) / DEFAULT_VALUES.PERCENTAGE_PRECISION,
        alertsByType: safeStatsMap(typeStats, 'type'),
        alertsByPriority: safeStatsMap(priorityStats, 'priority')
      };
    }, INTERVALS.CACHE_DEFAULT_TTL); // Cache for 5 minutes
  }

  // Clean up old alerts (older than specified days)
  static async cleanupOldAlerts(daysOld: number = TIME_PERIODS.ALERT_CLEANUP_DEFAULT_DAYS): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysOld * INTERVALS.DAY);
    
    const count = await this.db(this.getTableName())
      .where('created_at', '<', cutoffDate)
      .where('status', 'sent')
      .del();

    return count;
  }

  // Get alerts for a specific product
  static async findByProductId(
    productId: string,
    options: {
      days?: number;
      limit?: number;
    } = {}
  ): Promise<IAlert[]> {
    const { days = TIME_PERIODS.DEFAULT_HISTORY_DAYS, limit = DEFAULT_VALUES.DEFAULT_RECENT_ALERTS_LIMIT } = options;
    const cutoffDate = new Date(Date.now() - days * INTERVALS.DAY);

    return this.db(this.getTableName())
      .where('product_id', productId)
      .where('created_at', '>=', cutoffDate)
      .orderBy('created_at', 'desc')
      .limit(limit);
  }

  // Schedule alert for future delivery
  static async scheduleAlert(
    alertData: Partial<IAlert>,
    scheduledFor: Date
  ): Promise<IAlert> {
    const alert = new Alert();
    const sanitizedData = alert.sanitize({
      ...alertData,
      scheduled_for: scheduledFor,
      status: 'pending'
    });
    
    // Validate the data
    const errors = alert.validate(sanitizedData);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
    }

    return this.create<IAlert>(sanitizedData);
  }
}