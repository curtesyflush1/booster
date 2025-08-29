import { Alert } from '../models/Alert';
import { IAlert } from '../types/database';
import { IAlertRepository } from './IAlertRepository';
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

  async createAlert(data: Partial<IAlert>): Promise<IAlert> {
    try {
      return await Alert.createAlert(data);
    } catch (error) {
      logger.error('Error creating alert', error, { data });
      throw error;
    }
  }

  async markAsSent(id: string, channels: string[]): Promise<void> {
    try {
      await Alert.markAsSent(id, channels);
    } catch (error) {
      logger.error('Error marking alert as sent', error, { id, channels });
      throw error;
    }
  }

  async markAsFailed(id: string, reason: string): Promise<void> {
    try {
      await Alert.markAsFailed(id, reason);
    } catch (error) {
      logger.error('Error marking alert as failed', error, { id, reason });
      throw error;
    }
  }

  async findById(id: string): Promise<IAlert | null> {
    try {
      return await Alert.findById<IAlert>(id);
    } catch (error) {
      logger.error('Error finding alert by ID', error, { id });
      throw error;
    }
  }

  async findBy(criteria: Partial<IAlert>): Promise<IAlert[]> {
    try {
      const result = await Alert.findBy<IAlert>(criteria, { limit: 1000 });
      return result.data;
    } catch (error) {
      logger.error('Error finding alerts by criteria', error, { criteria });
      throw error;
    }
  }

  async updateById(id: string, data: Partial<IAlert>): Promise<IAlert | null> {
    try {
      return await Alert.updateById<IAlert>(id, data);
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