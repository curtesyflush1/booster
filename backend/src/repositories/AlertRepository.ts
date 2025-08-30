import { Alert } from '../models/Alert';
import { IAlert } from '../types/database';
import { IAlertRepository } from './IAlertRepository';
import { IAlertCreationData } from '../types/dependencies';
import { logger } from '../utils/logger';

/**
 * Alert repository implementation
 */
export class AlertRepository implements IAlertRepository {
  async findPendingAlerts(limit: number): Promise<IAlert[]> {
    try {
      const result = await Alert.findBy<IAlert>(
        { status: 'pending' },
        { 
          limit, 
          orderBy: 'created_at', 
          orderDirection: 'asc' 
        }
      );
      return result.data;
    } catch (error) {
      logger.error('Error finding pending alerts', error);
      throw error;
    }
  }

  async getPendingAlerts(limit: number): Promise<IAlert[]> {
    return this.findPendingAlerts(limit);
  }

  async findFailedAlertsForRetry(maxRetries: number): Promise<IAlert[]> {
    try {
      // This would ideally be a more complex query with retry_count < maxRetries
      // For now, we'll use the existing method from the Alert model
      return Alert.getFailedAlertsForRetry(maxRetries);
    } catch (error) {
      logger.error('Error finding failed alerts for retry', error);
      throw error;
    }
  }

  async getFailedAlertsForRetry(maxRetries: number): Promise<IAlert[]> {
    return this.findFailedAlertsForRetry(maxRetries);
  }

  async createAlert<T = any>(alertData: IAlertCreationData): Promise<T> {
    try {
      // Convert IAlertCreationData to Partial<IAlert>
      const alertCreateData: Partial<IAlert> = {
        user_id: alertData.user_id,
        product_id: alertData.product_id,
        retailer_id: alertData.retailer_id,
        watch_id: alertData.watch_id,
        type: alertData.type,
        priority: alertData.priority || 'medium',
        data: alertData.data as any, // Type assertion to handle the data mismatch
        delivery_channels: alertData.delivery_channels
      };
      return await Alert.createAlert(alertCreateData) as T;
    } catch (error) {
      logger.error('Error creating alert', error, { alertData });
      throw error;
    }
  }

  async markAsSent(alertId: string, channels: string[]): Promise<boolean> {
    try {
      await Alert.markAsSent(alertId, channels);
      return true;
    } catch (error) {
      logger.error('Error marking alert as sent', error, { alertId, channels });
      return false;
    }
  }

  async markAsFailed(alertId: string, reason: string): Promise<boolean> {
    try {
      await Alert.markAsFailed(alertId, reason);
      return true;
    } catch (error) {
      logger.error('Error marking alert as failed', error, { alertId, reason });
      return false;
    }
  }

  async findById<T = any>(id: string): Promise<T | null> {
    try {
      return await Alert.findById<T>(id);
    } catch (error) {
      logger.error('Error finding alert by ID', error, { id });
      throw error;
    }
  }

  async findBy<T = any>(criteria: Partial<T>): Promise<T[]> {
    try {
      const result = await Alert.findBy<T>(criteria, { limit: 1000 });
      return result.data;
    } catch (error) {
      logger.error('Error finding alerts by criteria', error, { criteria });
      throw error;
    }
  }

  async updateById<T = any>(id: string, data: Partial<T>): Promise<T | null> {
    try {
      return await Alert.updateById<T>(id, data);
    } catch (error) {
      logger.error('Error updating alert', error, { id, data });
      throw error;
    }
  }

  async findByUserId(userId: string, limit: number = 100): Promise<IAlert[]> {
    try {
      const result = await Alert.findBy<IAlert>(
        { user_id: userId },
        { 
          limit, 
          orderBy: 'created_at', 
          orderDirection: 'desc' 
        }
      );
      return result.data;
    } catch (error) {
      logger.error('Error finding alerts by user ID', error, { userId });
      throw error;
    }
  }

  async getAlertsByUser(userId: string, options?: any): Promise<any> {
    // This would need to be implemented with pagination
    // For now, return the existing findByUserId result
    const alerts = await this.findByUserId(userId, options?.limit || 100);
    return {
      data: alerts,
      pagination: {
        page: options?.page || 1,
        limit: options?.limit || 100,
        total: alerts.length
      }
    };
  }

  async getAlertsByType(type: string, options?: any): Promise<any> {
    const alerts = await this.findBy({ type });
    return {
      data: alerts,
      pagination: {
        page: options?.page || 1,
        limit: options?.limit || 100,
        total: alerts.length
      }
    };
  }

  async deleteExpiredAlerts(olderThan: Date): Promise<number> {
    // Convert Date to days for the existing method
    const daysDiff = Math.floor((Date.now() - olderThan.getTime()) / (1000 * 60 * 60 * 24));
    return this.deleteOldAlerts(daysDiff);
  }

  async getStats(): Promise<{
    pending: number;
    failed: number;
    sent: number;
    total: number;
  }> {
    try {
      const [pending, failed, sent, total] = await Promise.all([
        Alert.count<IAlert>({ status: 'pending' }),
        Alert.count<IAlert>({ status: 'failed' }),
        Alert.count<IAlert>({ status: 'sent' }),
        Alert.count<IAlert>({})
      ]);

      return { pending, failed, sent, total };
    } catch (error) {
      logger.error('Error getting alert stats', error);
      throw error;
    }
  }

  async bulkCreate(alerts: Partial<IAlert>[]): Promise<IAlert[]> {
    try {
      return await Alert.bulkCreate<IAlert>(alerts);
    } catch (error) {
      logger.error('Error bulk creating alerts', error, { count: alerts.length });
      throw error;
    }
  }

  async deleteOldAlerts(olderThanDays: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      // This would need a custom query or method on the Alert model
      // For now, we'll use a placeholder implementation
      const oldAlerts = await Alert.findByUnpaginated<IAlert>(
        {},
        {
          maxRecords: 10000,
          reason: 'Cleanup old alerts'
        }
      );

      const alertsToDelete = oldAlerts.filter(alert => 
        new Date(alert.created_at) < cutoffDate
      );

      let deletedCount = 0;
      for (const alert of alertsToDelete) {
        const deleted = await Alert.deleteById(alert.id);
        if (deleted) deletedCount++;
      }

      logger.info('Deleted old alerts', { deletedCount, olderThanDays });
      return deletedCount;
    } catch (error) {
      logger.error('Error deleting old alerts', error, { olderThanDays });
      throw error;
    }
  }
}