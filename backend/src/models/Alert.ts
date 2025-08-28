import { BaseModel } from './BaseModel';
import { IAlert, IValidationError, IPaginatedResult } from '../types/database';
import { safeCount, safeStatsMap } from '../utils/database';
import { handleDatabaseError } from '../config/database';
import { logger } from '../utils/logger';
import { withCache } from '../utils/cache';

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
      const retryError = Alert.validateNumeric(data.retry_count, 'retry_count', 0, 10);
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
        page = 1,
        limit = 20
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
  static async getPendingAlerts(limit: number = 100): Promise<IAlert[]> {
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
  static async getFailedAlertsForRetry(maxRetries: number = 3): Promise<IAlert[]> {
    return this.db(this.getTableName())
      .where('status', 'failed')
      .where('retry_count', '<', maxRetries)
      .orderBy('created_at', 'asc')
      .limit(50);
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

  // Get alert statistics for a user
  static async getUserAlertStats(userId: string): Promise<{
    total: number;
    unread: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    clickThroughRate: number;
    recentAlerts: number;
  }> {
    const totalResult = await this.db(this.getTableName())
      .where('user_id', userId)
      .count('* as count');

    const unreadResult = await this.db(this.getTableName())
      .where('user_id', userId)
      .whereNull('read_at')
      .count('* as count');

    // Get counts by type
    const typeStats = await this.db(this.getTableName())
      .select('type')
      .count('* as count')
      .where('user_id', userId)
      .groupBy('type');

    // Get counts by status
    const statusStats = await this.db(this.getTableName())
      .select('status')
      .count('* as count')
      .where('user_id', userId)
      .groupBy('status');

    // Calculate click-through rate
    const sentResult = await this.db(this.getTableName())
      .where('user_id', userId)
      .where('status', 'sent')
      .count('* as count');

    const clickedResult = await this.db(this.getTableName())
      .where('user_id', userId)
      .whereNotNull('clicked_at')
      .count('* as count');

    // Get recent alerts (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentResult = await this.db(this.getTableName())
      .where('user_id', userId)
      .where('created_at', '>=', sevenDaysAgo)
      .count('* as count');

    const sentCount = safeCount(sentResult);
    const clickedCount = safeCount(clickedResult);
    const clickThroughRate = sentCount > 0 ? (clickedCount / sentCount) * 100 : 0;

    return {
      total: safeCount(totalResult),
      unread: safeCount(unreadResult),
      byType: safeStatsMap(typeStats, 'type'),
      byStatus: safeStatsMap(statusStats, 'status'),
      clickThroughRate: Math.round(clickThroughRate * 100) / 100,
      recentAlerts: safeCount(recentResult)
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
        avgDeliveryTime: Math.round(avgDeliveryTime * 100) / 100,
        alertsByType: safeStatsMap(typeStats, 'type'),
        alertsByPriority: safeStatsMap(priorityStats, 'priority')
      };
    }, 5 * 60 * 1000); // Cache for 5 minutes
  }

  // Clean up old alerts (older than specified days)
  static async cleanupOldAlerts(daysOld: number = 90): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    
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
    const { days = 30, limit = 100 } = options;
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

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