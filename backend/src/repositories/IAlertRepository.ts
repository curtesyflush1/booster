import { IAlert } from '../types/database';
import { IPaginatedResult, IPaginationOptions } from '../types/dependencies';
import { IAlertCreationData } from '../types/dependencies';

/**
 * Alert repository interface
 */
export interface IAlertRepository {
  /**
   * Find pending alerts with limit
   */
  findPendingAlerts(limit: number): Promise<IAlert[]>;

  /**
   * Find failed alerts that can be retried
   */
  findFailedAlertsForRetry(maxRetries: number): Promise<IAlert[]>;

  /**
   * Create a new alert
   */
  createAlert<T = any>(alertData: IAlertCreationData): Promise<T>;

  /**
   * Mark alert as sent
   */
  markAsSent(alertId: string, channels: string[]): Promise<boolean>;

  /**
   * Mark alert as failed
   */
  markAsFailed(alertId: string, reason: string): Promise<boolean>;

  /**
   * Find alert by ID
   */
  findById<T = any>(id: string): Promise<T | null>;

  /**
   * Find alerts by criteria
   */
  findBy<T = any>(criteria: Partial<T>): Promise<T[]>;

  /**
   * Update alert by ID
   */
  updateById<T = any>(id: string, data: Partial<T>): Promise<T | null>;

  /**
   * Get alerts for a specific user
   */
  getAlertsByUser(userId: string, options?: IPaginationOptions): Promise<IPaginatedResult<IAlert>>;

  /**
   * Get alerts by type
   */
  getAlertsByType(type: string, options?: IPaginationOptions): Promise<IPaginatedResult<IAlert>>;

  /**
   * Delete expired alerts
   */
  deleteExpiredAlerts(olderThan: Date): Promise<number>;

  /**
   * Get alerts for a specific user (legacy method)
   */
  findByUserId(userId: string, limit?: number): Promise<IAlert[]>;

  /**
   * Get alert statistics
   */
  getStats(): Promise<{
    pending: number;
    failed: number;
    sent: number;
    total: number;
  }>;

  /**
   * Bulk create alerts
   */
  bulkCreate(alerts: Partial<IAlert>[]): Promise<IAlert[]>;

  /**
   * Delete old alerts
   */
  deleteOldAlerts(olderThanDays: number): Promise<number>;
}