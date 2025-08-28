import { Alert } from '../models/Alert';
import { IAlertRepository } from '../types/dependencies';
import { IAlert } from '../types/database';

/**
 * Alert repository implementation that wraps the Alert model
 * This provides a clean interface for dependency injection
 */
export class AlertRepository implements IAlertRepository {
  async findById<T>(id: string): Promise<T | null> {
    return Alert.findById<T>(id);
  }

  async findBy<T>(criteria: Partial<T>): Promise<T[]> {
    return Alert.findBy<T>(criteria);
  }

  async createAlert(alertData: any): Promise<IAlert> {
    return Alert.createAlert(alertData);
  }

  async updateById<T>(id: string, data: Partial<T>): Promise<T | null> {
    return Alert.updateById<T>(id, data);
  }

  async markAsSent(alertId: string, channels: string[]): Promise<boolean> {
    return Alert.markAsSent(alertId, channels);
  }

  async markAsFailed(alertId: string, reason: string): Promise<boolean> {
    return Alert.markAsFailed(alertId, reason);
  }

  async getPendingAlerts(limit: number): Promise<IAlert[]> {
    return Alert.getPendingAlerts(limit);
  }

  async getFailedAlertsForRetry(maxRetries: number): Promise<IAlert[]> {
    return Alert.getFailedAlertsForRetry(maxRetries);
  }
}