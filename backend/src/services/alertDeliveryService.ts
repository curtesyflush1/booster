import { IAlert, IUser, IAlertDelivery } from '../types/database';
import { logger } from '../utils/logger';
import { WebPushService } from './notifications/webPushService';
import { EmailService } from './notifications/emailService';
import { SMSService } from './notifications/smsService';
import { DiscordService } from './notifications/discordService';
import { HTTP_TIMEOUTS, INTERVALS, PERFORMANCE_CONFIG } from '../constants';

export interface DeliveryResult {
  success: boolean;
  successfulChannels: string[];
  failedChannels: string[];
  error?: string;
  deliveryIds: string[];
}

export interface ChannelDeliveryResult {
  channel: string;
  success: boolean;
  deliveryId?: string | undefined;
  externalId?: string | undefined;
  error?: string | undefined;
  metadata?: Record<string, any> | undefined;
}

export class AlertDeliveryService {
  private static readonly DELIVERY_TIMEOUT_MS = HTTP_TIMEOUTS.ALERT_DELIVERY;
  private static readonly MAX_CONCURRENT_DELIVERIES = PERFORMANCE_CONFIG.MAX_CONCURRENT_DELIVERIES;

  /**
   * Deliver alert through multiple channels
   */
  static async deliverAlert(
    alert: IAlert,
    user: IUser,
    channels: string[]
  ): Promise<DeliveryResult> {
    try {
      logger.info('Starting alert delivery', {
        alertId: alert.id,
        userId: user.id,
        channels
      });

      const deliveryPromises = channels.map(channel => 
        this.deliverToChannel(alert, user, channel)
      );

      // Wait for all deliveries with timeout
      const results = await Promise.allSettled(
        deliveryPromises.map(promise => 
          this.withTimeout(promise, this.DELIVERY_TIMEOUT_MS)
        )
      );

      const successfulChannels: string[] = [];
      const failedChannels: string[] = [];
      const deliveryIds: string[] = [];
      const errors: string[] = [];

      results.forEach((result, index) => {
        const channel = channels[index];
        if (!channel) return; // Skip if channel is undefined
        
        if (result.status === 'fulfilled' && result.value.success) {
          successfulChannels.push(channel);
          if (result.value.deliveryId) {
            deliveryIds.push(result.value.deliveryId);
          }
        } else {
          failedChannels.push(channel);
          const error = result.status === 'rejected' 
            ? result.reason?.message || 'Unknown error'
            : result.value.error || 'Delivery failed';
          errors.push(`${channel}: ${error}`);
        }
      });

      const overallSuccess = successfulChannels.length > 0;
      
      logger.info('Alert delivery completed', {
        alertId: alert.id,
        successfulChannels,
        failedChannels,
        overallSuccess
      });

      const deliveryResult: DeliveryResult = {
        success: overallSuccess,
        successfulChannels,
        failedChannels,
        deliveryIds
      };

      if (errors.length > 0) {
        deliveryResult.error = errors.join('; ');
      }

      return deliveryResult;

    } catch (error) {
      logger.error('Alert delivery failed', {
        alertId: alert.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        successfulChannels: [],
        failedChannels: channels,
        error: error instanceof Error ? error.message : 'Unknown error',
        deliveryIds: []
      };
    }
  }

  /**
   * Deliver alert to a specific channel
   */
  private static async deliverToChannel(
    alert: IAlert,
    user: IUser,
    channel: string
  ): Promise<ChannelDeliveryResult> {
    try {
      logger.debug('Delivering to channel', {
        alertId: alert.id,
        channel
      });

      // Create delivery record
      const deliveryRecord = await this.createDeliveryRecord(alert.id, channel);

      let result: ChannelDeliveryResult;

      switch (channel) {
        case 'web_push':
          result = await WebPushService.sendNotification(alert, user);
          break;
        case 'email':
          result = await EmailService.sendAlert(alert, user);
          break;
        case 'sms':
          result = await SMSService.sendAlert(alert, user);
          break;
        case 'discord':
          result = await DiscordService.sendAlert(alert, user);
          break;
        default:
          throw new Error(`Unsupported delivery channel: ${channel}`);
      }

      // Update delivery record
      const updateData: Partial<IAlertDelivery> = {
        status: result.success ? 'sent' : 'failed',
        metadata: result.metadata || {},
        sent_at: new Date()
      };

      if (result.externalId) {
        updateData.external_id = result.externalId;
      }

      if (result.error) {
        updateData.failure_reason = result.error;
      }

      await this.updateDeliveryRecord(deliveryRecord.id, updateData);

      return {
        ...result,
        deliveryId: deliveryRecord.id
      };

    } catch (error) {
      logger.error('Channel delivery failed', {
        alertId: alert.id,
        channel,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        channel,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create delivery record in database
   */
  private static async createDeliveryRecord(
    alertId: string,
    channel: string
  ): Promise<IAlertDelivery> {
    // This would typically use a proper model, but for now we'll simulate
    const deliveryRecord: IAlertDelivery = {
      id: this.generateId(),
      alert_id: alertId,
      channel: channel as any,
      status: 'pending',
      metadata: {},
      retry_count: 0,
      created_at: new Date(),
      updated_at: new Date()
    };

    // In a real implementation, this would save to database
    logger.debug('Created delivery record', {
      deliveryId: deliveryRecord.id,
      alertId,
      channel
    });

    return deliveryRecord;
  }

  /**
   * Update delivery record
   */
  private static async updateDeliveryRecord(
    deliveryId: string,
    updates: Partial<IAlertDelivery>
  ): Promise<void> {
    // In a real implementation, this would update the database
    logger.debug('Updated delivery record', {
      deliveryId,
      updates
    });
  }

  /**
   * Retry failed delivery
   */
  static async retryDelivery(deliveryId: string): Promise<ChannelDeliveryResult> {
    try {
      // In a real implementation, this would fetch the delivery record from database
      // For now, we'll simulate
      logger.info('Retrying delivery', { deliveryId });

      // This would contain the actual retry logic
      return {
        channel: 'unknown',
        success: false,
        error: 'Retry not implemented yet'
      };

    } catch (error) {
      logger.error('Delivery retry failed', {
        deliveryId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        channel: 'unknown',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get delivery status for an alert
   */
  static async getDeliveryStatus(alertId: string): Promise<{
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    pendingDeliveries: number;
    deliveries: IAlertDelivery[];
  }> {
    try {
      // In a real implementation, this would query the database
      // For now, we'll return a mock response
      const deliveries: IAlertDelivery[] = [];

      return {
        totalDeliveries: deliveries.length,
        successfulDeliveries: deliveries.filter(d => d.status === 'delivered').length,
        failedDeliveries: deliveries.filter(d => d.status === 'failed').length,
        pendingDeliveries: deliveries.filter(d => d.status === 'pending').length,
        deliveries
      };

    } catch (error) {
      logger.error('Failed to get delivery status', {
        alertId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        pendingDeliveries: 0,
        deliveries: []
      };
    }
  }

  /**
   * Bulk delivery for multiple alerts
   */
  static async bulkDeliverAlerts(
    alerts: Array<{ alert: IAlert; user: IUser; channels: string[] }>
  ): Promise<DeliveryResult[]> {
    try {
      logger.info(`Starting bulk delivery for ${alerts.length} alerts`);

      // Process in batches to avoid overwhelming external services
      const batchSize = this.MAX_CONCURRENT_DELIVERIES;
      const results: DeliveryResult[] = [];

      for (let i = 0; i < alerts.length; i += batchSize) {
        const batch = alerts.slice(i, i + batchSize);
        const batchPromises = batch.map(({ alert, user, channels }) =>
          this.deliverAlert(alert, user, channels)
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Small delay between batches to be respectful to external services
        if (i + batchSize < alerts.length) {
          await this.delay(INTERVALS.ALERT_DELIVERY_BATCH_DELAY);
        }
      }

      logger.info('Bulk delivery completed', {
        totalAlerts: alerts.length,
        successfulAlerts: results.filter(r => r.success).length
      });

      return results;

    } catch (error) {
      logger.error('Bulk delivery failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get delivery statistics
   */
  static async getDeliveryStats(timeframe: 'hour' | 'day' | 'week' = 'day'): Promise<{
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    deliveriesByChannel: Record<string, number>;
    avgDeliveryTime: number;
    successRate: number;
  }> {
    try {
      // In a real implementation, this would query the database
      // For now, we'll return mock stats
      return {
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        deliveriesByChannel: {},
        avgDeliveryTime: 0,
        successRate: 0
      };

    } catch (error) {
      logger.error('Failed to get delivery stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Validate delivery channel configuration
   */
  static async validateChannelConfig(channel: string, user: IUser): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    switch (channel) {
      case 'web_push':
        // Web push is always available
        break;
      case 'email':
        if (!user.email || !user.email_verified) {
          errors.push('Email not verified');
        }
        break;
      case 'sms':
        if (user.subscription_tier !== 'pro') {
          errors.push('SMS requires Pro subscription');
        }
        // Would check for phone number in user profile
        break;
      case 'discord':
        if (user.subscription_tier !== 'pro') {
          errors.push('Discord requires Pro subscription');
        }
        if (!user.notification_settings.discord_webhook) {
          errors.push('Discord webhook not configured');
        }
        break;
      default:
        errors.push(`Unsupported channel: ${channel}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Helper method to add timeout to promises
   */
  private static withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Delivery timeout')), timeoutMs)
      )
    ]);
  }

  /**
   * Helper method to add delays
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate unique ID (simplified)
   */
  private static generateId(): string {
    return `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}