import { IAlert } from '../types/database';

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
  createAlert(data: Partial<IAlert>): Promise<IAlert>;

  /**
   * Mark alert as sent
   */
  markAsSent(id: string, channels: string[]): Promise<void>;

  /**
   * Mark alert as failed
   */
  markAsFailed(id: string, reason: string): Promise<void>;

  /**
   * Find alert by ID
   */
  findById(id: string): Promise<IAlert | null>;

  /**
   * Find alerts by criteria
   */
  findBy(criteria: Partial<IAlert>): Promise<IAlert[]>;

  /**
   * Update alert by ID
   */
  updateById(id: string, data: Partial<IAlert>): Promise<IAlert | null>;

  /**
   * Get alerts for a specific user
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