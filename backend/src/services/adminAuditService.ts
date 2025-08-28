import { BaseModel } from '../models/BaseModel';
import { IAdminAuditLog } from '../types/database';
import { logger } from '../utils/logger';

export class AdminAuditService {
  /**
   * Log an admin action
   */
  static async logAction(
    adminUserId: string,
    action: string,
    targetType?: string,
    targetId?: string,
    details: Record<string, any> = {},
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      const auditData: Partial<IAdminAuditLog> = {
        admin_user_id: adminUserId,
        action,
        target_type: targetType,
        target_id: targetId,
        details,
        ip_address: ipAddress,
        user_agent: userAgent
      };

      await BaseModel.create<IAdminAuditLog>(auditData, 'admin_audit_log');

      logger.info('Admin action logged', {
        adminUserId,
        action,
        targetType,
        targetId,
        ipAddress
      });
    } catch (error) {
      logger.error('Failed to log admin action', {
        error: error instanceof Error ? error.message : String(error),
        adminUserId,
        action,
        targetType,
        targetId
      });
    }
  }

  /**
   * Get audit logs with pagination and filtering
   */
  static async getAuditLogs(
    page: number = 1,
    limit: number = 50,
    filters: {
      adminUserId?: string;
      action?: string;
      targetType?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{
    logs: IAdminAuditLog[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const offset = (page - 1) * limit;
      let query = BaseModel.getKnex()('admin_audit_log')
        .select('*')
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset);

      let countQuery = BaseModel.getKnex()('admin_audit_log').count('* as count');

      // Apply filters
      if (filters.adminUserId) {
        query = query.where('admin_user_id', filters.adminUserId);
        countQuery = countQuery.where('admin_user_id', filters.adminUserId);
      }

      if (filters.action) {
        query = query.where('action', 'ilike', `%${filters.action}%`);
        countQuery = countQuery.where('action', 'ilike', `%${filters.action}%`);
      }

      if (filters.targetType) {
        query = query.where('target_type', filters.targetType);
        countQuery = countQuery.where('target_type', filters.targetType);
      }

      if (filters.startDate) {
        query = query.where('created_at', '>=', filters.startDate);
        countQuery = countQuery.where('created_at', '>=', filters.startDate);
      }

      if (filters.endDate) {
        query = query.where('created_at', '<=', filters.endDate);
        countQuery = countQuery.where('created_at', '<=', filters.endDate);
      }

      const [logs, countResult] = await Promise.all([
        query,
        countQuery.first()
      ]);

      const total = parseInt(countResult?.count as string) || 0;

      return {
        logs: logs as IAdminAuditLog[],
        total,
        page,
        limit
      };
    } catch (error) {
      logger.error('Failed to get audit logs', {
        error: error instanceof Error ? error.message : String(error),
        filters
      });
      throw new Error('Failed to retrieve audit logs');
    }
  }

  /**
   * Get audit log statistics
   */
  static async getAuditStats(days: number = 30): Promise<{
    totalActions: number;
    actionsByType: Record<string, number>;
    actionsByAdmin: Record<string, number>;
    recentActivity: IAdminAuditLog[];
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const knex = BaseModel.getKnex();

      // Get total actions
      const totalResult = await knex('admin_audit_log')
        .where('created_at', '>=', startDate)
        .count('* as count')
        .first();

      const totalActions = parseInt(totalResult?.count as string) || 0;

      // Get actions by type
      const actionsByTypeResult = await knex('admin_audit_log')
        .select('action')
        .count('* as count')
        .where('created_at', '>=', startDate)
        .groupBy('action')
        .orderBy('count', 'desc');

      const actionsByType: Record<string, number> = {};
      actionsByTypeResult.forEach(row => {
        actionsByType[row.action] = parseInt(row.count as string);
      });

      // Get actions by admin (with user email)
      const actionsByAdminResult = await knex('admin_audit_log')
        .select('admin_audit_log.admin_user_id', 'users.email')
        .count('* as count')
        .leftJoin('users', 'admin_audit_log.admin_user_id', 'users.id')
        .where('admin_audit_log.created_at', '>=', startDate)
        .groupBy('admin_audit_log.admin_user_id', 'users.email')
        .orderBy('count', 'desc');

      const actionsByAdmin: Record<string, number> = {};
      actionsByAdminResult.forEach(row => {
        const key = row.email || row.admin_user_id;
        actionsByAdmin[key] = parseInt(row.count as string);
      });

      // Get recent activity
      const recentActivity = await knex('admin_audit_log')
        .select('*')
        .orderBy('created_at', 'desc')
        .limit(10);

      return {
        totalActions,
        actionsByType,
        actionsByAdmin,
        recentActivity: recentActivity as IAdminAuditLog[]
      };
    } catch (error) {
      logger.error('Failed to get audit stats', {
        error: error instanceof Error ? error.message : String(error),
        days
      });
      throw new Error('Failed to retrieve audit statistics');
    }
  }
}