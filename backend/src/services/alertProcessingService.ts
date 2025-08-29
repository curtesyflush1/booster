import { Alert } from '../models/Alert';
import { User } from '../models/User';
import { Product } from '../models/Product';
import { Watch } from '../models/Watch';
import { QuietHoursService } from './quietHoursService';
import { AlertDeliveryService } from './alertDeliveryService';
import { CachedUserService } from './cachedUserService';
import { logger } from '../utils/logger';
import { IAlert, IUser, IProduct, IWatch, IAlertData } from '../types/database';
import { AlertProcessorFactory } from './alertStrategies/AlertProcessorFactory';
import { AlertGenerationData } from './alertStrategies/AlertProcessingStrategy';

// Custom error types for better error handling
export class AlertValidationError extends Error {
  constructor(message: string, public errors: string[]) {
    super(message);
    this.name = 'AlertValidationError';
  }
}

export class AlertRateLimitError extends Error {
  constructor(message: string, public userId: string) {
    super(message);
    this.name = 'AlertRateLimitError';
  }
}

// AlertGenerationData is now imported from the strategy interface

export interface AlertProcessingResult {
  alertId: string;
  status: 'processed' | 'scheduled' | 'failed' | 'deduplicated';
  scheduledFor?: Date;
  reason?: string;
  deliveryChannels?: string[];
}

export interface AlertDeduplicationKey {
  userId: string;
  productId: string;
  retailerId: string;
  type: string;
}

export interface AlertProcessResult {
  success: boolean;
  rescheduled?: boolean;
  deliveryChannels?: string[];
  reason?: string;
}

export class AlertProcessingService {
  private static readonly DEDUPLICATION_WINDOW_MINUTES = 15;
  private static readonly MAX_ALERTS_PER_USER_PER_HOUR = 50;
  private static readonly MAX_RETRY_ATTEMPTS = 3;
  private static readonly DEFAULT_SCHEDULE_DELAY_HOURS = 1;
  private static readonly POPULARITY_THRESHOLD_HIGH = 500;
  private static readonly POPULARITY_THRESHOLD_URGENT = 800;
  private static readonly PRICE_DROP_THRESHOLD_HIGH = 20;
  private static readonly STATS_QUERY_LIMIT = 1000;

  /**
   * Generate and process a new alert
   */
  static async generateAlert(alertData: AlertGenerationData): Promise<AlertProcessingResult> {
    try {
      logger.info('Generating alert', {
        userId: alertData.userId,
        productId: alertData.productId,
        type: alertData.type
      });

      // Validate input data
      const validationResult = await this.validateAlertData(alertData);
      if (!validationResult.isValid) {
        throw new AlertValidationError(
          `Alert validation failed: ${validationResult.errors.join(', ')}`,
          validationResult.errors
        );
      }

      // Check for duplicates
      const deduplicationResult = await this.checkForDuplicates(alertData);
      if (deduplicationResult.isDuplicate) {
        logger.info('Alert deduplicated', {
          userId: alertData.userId,
          productId: alertData.productId,
          reason: deduplicationResult.reason
        });
        return {
          alertId: deduplicationResult.existingAlertId!,
          status: 'deduplicated',
          reason: deduplicationResult.reason || 'Alert deduplicated'
        };
      }

      // Check rate limits
      const rateLimitResult = await this.checkRateLimits(alertData.userId);
      if (!rateLimitResult.allowed) {
        logger.warn('Alert rate limited', {
          userId: alertData.userId,
          reason: rateLimitResult.reason
        });
        throw new AlertRateLimitError(
          `Rate limit exceeded: ${rateLimitResult.reason}`,
          alertData.userId
        );
      }

      // Use strategy pattern to determine priority
      const strategy = AlertProcessorFactory.getProcessor(alertData.type);
      const priority = alertData.priority || await strategy.calculatePriority(alertData);

      // Create the alert
      const alertCreateData: Partial<IAlert> = {
        user_id: alertData.userId,
        product_id: alertData.productId,
        retailer_id: alertData.retailerId,
        type: alertData.type,
        priority,
        data: alertData.data,
        status: 'pending'
      };

      if (alertData.watchId) {
        alertCreateData.watch_id = alertData.watchId;
      }

      const alert = await Alert.createAlert(alertCreateData);

      // Check quiet hours and schedule accordingly
      const quietHoursCheck = await QuietHoursService.isQuietTime(alertData.userId);
      if (quietHoursCheck.isQuietTime) {
        const scheduledFor = quietHoursCheck.nextActiveTime || new Date(Date.now() + this.DEFAULT_SCHEDULE_DELAY_HOURS * 60 * 60 * 1000);
        await Alert.updateById<IAlert>(alert.id, {
          scheduled_for: scheduledFor,
          status: 'pending'
        });

        logger.info('Alert scheduled for after quiet hours', {
          alertId: alert.id,
          scheduledFor,
          reason: quietHoursCheck.reason
        });

        return {
          alertId: alert.id,
          status: 'scheduled',
          scheduledFor,
          reason: 'Scheduled due to quiet hours'
        };
      }

      // Process the alert immediately
      const processingResult = await this.processAlert(alert.id);
      const result: AlertProcessingResult = {
        alertId: alert.id,
        status: processingResult.success ? 'processed' : 'failed'
      };

      if (processingResult.deliveryChannels) {
        result.deliveryChannels = processingResult.deliveryChannels;
      }

      if (processingResult.reason) {
        result.reason = processingResult.reason;
      }

      return result;

    } catch (error) {
      logger.error('Failed to generate alert', {
        error: error instanceof Error ? error.message : 'Unknown error',
        alertData
      });
      throw error;
    }
  }

  /**
   * Process pending alerts
   */
  static async processPendingAlerts(limit: number = 100): Promise<{
    processed: number;
    failed: number;
    scheduled: number;
  }> {
    try {
      const pendingAlerts = await Alert.getPendingAlerts(limit);
      let processed = 0;
      let failed = 0;
      let scheduled = 0;

      logger.info(`Processing ${pendingAlerts.length} pending alerts`);

      for (const alert of pendingAlerts) {
        try {
          const result = await this.processAlert(alert.id);
          if (result.success) {
            processed++;
          } else if (result.rescheduled) {
            scheduled++;
          } else {
            failed++;
          }
        } catch (error) {
          logger.error('Failed to process individual alert', {
            alertId: alert.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          failed++;
        }
      }

      logger.info('Completed processing pending alerts', {
        processed,
        failed,
        scheduled,
        total: pendingAlerts.length
      });

      return { processed, failed, scheduled };
    } catch (error) {
      logger.error('Failed to process pending alerts', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Process a specific alert
   */
  static async processAlert(alertId: string): Promise<AlertProcessResult> {
    try {
      const alert = await Alert.findById<IAlert>(alertId);
      if (!alert) {
        throw new Error('Alert not found');
      }

      // Check if user is in quiet hours
      const quietHoursCheck = await QuietHoursService.isQuietTime(alert.user_id);
      if (quietHoursCheck.isQuietTime) {
        const scheduledFor = quietHoursCheck.nextActiveTime || new Date(Date.now() + this.DEFAULT_SCHEDULE_DELAY_HOURS * 60 * 60 * 1000);
        await Alert.updateById<IAlert>(alertId, {
          scheduled_for: scheduledFor
        });

        logger.info('Alert rescheduled due to quiet hours', {
          alertId,
          scheduledFor,
          reason: quietHoursCheck.reason
        });

        return {
          success: false,
          rescheduled: true,
          reason: 'Rescheduled due to quiet hours'
        };
      }

      // Get user preferences for delivery channels (with caching)
      const user = await CachedUserService.getUserWithPreferences(alert.user_id);
      if (!user) {
        await Alert.markAsFailed(alertId, 'User not found');
        return { success: false, reason: 'User not found' };
      }

      // Use strategy pattern to determine delivery channels
      const strategy = AlertProcessorFactory.getProcessor(alert.type as any);
      const deliveryChannels = strategy.determineDeliveryChannels(user, alert);
      if (deliveryChannels.length === 0) {
        await Alert.markAsFailed(alertId, 'No delivery channels available');
        return { success: false, reason: 'No delivery channels available' };
      }

      // Deliver the alert
      const deliveryResult = await AlertDeliveryService.deliverAlert(alert, user, deliveryChannels);
      
      if (deliveryResult.success) {
        await Alert.markAsSent(alertId, deliveryResult.successfulChannels);
        
        // Update watch alert count if applicable
        if (alert.watch_id) {
          await this.updateWatchAlertCount(alert.watch_id);
        }

        logger.info('Alert processed successfully', {
          alertId,
          deliveryChannels: deliveryResult.successfulChannels
        });

        return {
          success: true,
          deliveryChannels: deliveryResult.successfulChannels
        };
      } else {
        await Alert.markAsFailed(alertId, deliveryResult.error || 'Delivery failed');
        return {
          success: false,
          reason: deliveryResult.error || 'Delivery failed'
        };
      }

    } catch (error) {
      logger.error('Failed to process alert', {
        alertId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      await Alert.markAsFailed(alertId, error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        reason: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Retry failed alerts
   */
  static async retryFailedAlerts(): Promise<{
    retried: number;
    succeeded: number;
    permanentlyFailed: number;
  }> {
    try {
      const failedAlerts = await Alert.getFailedAlertsForRetry(this.MAX_RETRY_ATTEMPTS);
      let retried = 0;
      let succeeded = 0;
      let permanentlyFailed = 0;

      logger.info(`Retrying ${failedAlerts.length} failed alerts`);

      for (const alert of failedAlerts) {
        try {
          retried++;
          const result = await this.processAlert(alert.id);
          
          if (result.success) {
            succeeded++;
          } else if (alert.retry_count >= this.MAX_RETRY_ATTEMPTS - 1) {
            // Mark as permanently failed
            await Alert.updateById<IAlert>(alert.id, {
              status: 'failed',
              failure_reason: 'Max retry attempts exceeded'
            });
            permanentlyFailed++;
          }
        } catch (error) {
          logger.error('Failed to retry alert', {
            alertId: alert.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      logger.info('Completed retrying failed alerts', {
        retried,
        succeeded,
        permanentlyFailed
      });

      return { retried, succeeded, permanentlyFailed };
    } catch (error) {
      logger.error('Failed to retry failed alerts', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Validate alert data
   */
  private static async validateAlertData(alertData: AlertGenerationData): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Basic input validation
    if (!alertData.userId?.trim()) {
      errors.push('User ID is required');
    }
    if (!alertData.productId?.trim()) {
      errors.push('Product ID is required');
    }
    if (!alertData.retailerId?.trim()) {
      errors.push('Retailer ID is required');
    }
    if (!['restock', 'price_drop', 'low_stock', 'pre_order'].includes(alertData.type)) {
      errors.push('Invalid alert type');
    }

    // Early return if basic validation fails
    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    // Database validation with parallel queries for performance (using cached user service)
    const [user, product, watch] = await Promise.all([
      CachedUserService.getUserWithPreferences(alertData.userId),
      Product.findById<IProduct>(alertData.productId),
      alertData.watchId ? Watch.findById<IWatch>(alertData.watchId) : null
    ]);

    // User validation
    if (!user) {
      errors.push('User not found');
    } else if (user.email_verified === false) {
      errors.push('User email not verified');
    }

    // Product validation
    if (!product) {
      errors.push('Product not found');
    } else if (!product.is_active) {
      errors.push('Product is inactive');
    }

    // Alert data structure validation
    if (!alertData.data?.product_name?.trim()) {
      errors.push('Product name is required in alert data');
    }
    if (!alertData.data?.retailer_name?.trim()) {
      errors.push('Retailer name is required in alert data');
    }
    if (!alertData.data?.product_url?.trim()) {
      errors.push('Product URL is required in alert data');
    }

    // URL validation
    if (alertData.data?.product_url) {
      try {
        new URL(alertData.data.product_url);
      } catch {
        errors.push('Invalid product URL format');
      }
    }

    // Watch validation
    if (alertData.watchId && watch) {
      if (!watch.is_active) {
        errors.push('Watch is inactive');
      } else if (watch.user_id !== alertData.userId) {
        errors.push('Watch does not belong to user');
      }
    } else if (alertData.watchId && !watch) {
      errors.push('Watch not found');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check for duplicate alerts
   */
  private static async checkForDuplicates(alertData: AlertGenerationData): Promise<{
    isDuplicate: boolean;
    existingAlertId?: string;
    reason?: string;
  }> {
    const deduplicationWindow = new Date(Date.now() - this.DEDUPLICATION_WINDOW_MINUTES * 60 * 1000);

    // Look for similar alerts within the deduplication window
    const existingAlerts = await Alert.findBy<IAlert>({
      user_id: alertData.userId,
      product_id: alertData.productId,
      retailer_id: alertData.retailerId,
      type: alertData.type
    });

    const recentAlert = existingAlerts.find(alert => 
      new Date(alert.created_at) > deduplicationWindow &&
      (alert.status === 'pending' || alert.status === 'sent')
    );

    if (recentAlert) {
      return {
        isDuplicate: true,
        existingAlertId: recentAlert.id,
        reason: `Similar alert exists within ${this.DEDUPLICATION_WINDOW_MINUTES} minutes`
      };
    }

    return { isDuplicate: false };
  }

  /**
   * Check rate limits for user
   */
  private static async checkRateLimits(userId: string): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    const oneHourAgo = new Date(Date.now() - this.DEFAULT_SCHEDULE_DELAY_HOURS * 60 * 60 * 1000);
    
    // Count alerts sent to user in the last hour
    const recentAlerts = await Alert.findBy<IAlert>({
      user_id: userId
    });

    const alertsInLastHour = recentAlerts.filter(alert => 
      new Date(alert.created_at) > oneHourAgo
    );

    if (alertsInLastHour.length >= this.MAX_ALERTS_PER_USER_PER_HOUR) {
      return {
        allowed: false,
        reason: `User has received ${alertsInLastHour.length} alerts in the last hour (limit: ${this.MAX_ALERTS_PER_USER_PER_HOUR})`
      };
    }

    return { allowed: true };
  }

  // Priority calculation and delivery channel determination now handled by strategy pattern

  /**
   * Update watch alert count
   */
  private static async updateWatchAlertCount(watchId: string): Promise<void> {
    try {
      const watch = await Watch.findById<IWatch>(watchId);
      if (watch) {
        await Watch.updateById<IWatch>(watchId, {
          alert_count: watch.alert_count + 1,
          last_alerted: new Date()
        });
      }
    } catch (error) {
      logger.error('Failed to update watch alert count', {
        watchId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get alert processing statistics
   */
  static async getProcessingStats(): Promise<{
    pendingAlerts: number;
    failedAlerts: number;
    alertsProcessedToday: number;
    avgProcessingTime: number;
    successRate: number;
  }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Optimize with parallel queries and better filtering
      const [pendingAlerts, failedAlerts, todayStats] = await Promise.all([
        Alert.getPendingAlerts(this.STATS_QUERY_LIMIT),
        Alert.getFailedAlertsForRetry(this.STATS_QUERY_LIMIT),
        this.getTodayAlertStats(today)
      ]);

      return {
        pendingAlerts: pendingAlerts.length,
        failedAlerts: failedAlerts.length,
        alertsProcessedToday: todayStats.total,
        avgProcessingTime: 0, // Would need more detailed tracking
        successRate: todayStats.successRate
      };
    } catch (error) {
      logger.error('Failed to get processing stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return this.getDefaultStats();
    }
  }

  /**
   * Get today's alert statistics optimized
   */
  private static async getTodayAlertStats(today: Date): Promise<{
    total: number;
    successRate: number;
  }> {
    // This should ideally be a single database query with aggregation
    // For now, we'll use the existing approach but with better structure
    const todayAlerts = await Alert.findBy<IAlert>({});
    const filteredAlerts = todayAlerts.filter(alert => 
      new Date(alert.created_at) >= today
    );

    const sentAlerts = filteredAlerts.filter(alert => alert.status === 'sent').length;
    const totalProcessed = filteredAlerts.filter(alert => 
      alert.status === 'sent' || alert.status === 'failed'
    ).length;
    
    const successRate = totalProcessed > 0 ? 
      Math.round((sentAlerts / totalProcessed) * 10000) / 100 : 0;

    return {
      total: filteredAlerts.length,
      successRate
    };
  }

  /**
   * Get default stats for error cases
   */
  private static getDefaultStats() {
    return {
      pendingAlerts: 0,
      failedAlerts: 0,
      alertsProcessedToday: 0,
      avgProcessingTime: 0,
      successRate: 0
    };
  }
}