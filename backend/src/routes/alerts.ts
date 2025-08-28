import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { sanitizeParameters } from '../middleware/parameterSanitization';
import { validate, validateBody, validateQuery, validateParams, alertSchemas } from '../validators';
import { verifyAlertOwnership } from '../middleware/alertOwnership';
import { Alert } from '../models/Alert';
import { AlertAnalyticsService } from '../services/alertAnalyticsService';
import { AlertValidationService } from '../services/alertValidationService';
import { logger } from '../utils/logger';
import { ResponseHelper } from '../utils/responseHelpers';

const router = express.Router();

// Get user's alerts with filtering and pagination
router.get('/',
  authenticate,
  validate(alertSchemas.getAlerts),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const {
        page = 1,
        limit = 20,
        status,
        type,
        unread_only = false,
        search,
        start_date,
        end_date
      } = req.query;

      const options: {
        status?: string;
        type?: string;
        unread_only?: boolean;
        search?: string;
        start_date?: Date;
        end_date?: Date;
        page?: number;
        limit?: number;
      } = {};

      if (status) options.status = status as string;
      if (type) options.type = type as string;
      if (unread_only === 'true') options.unread_only = true;
      if (search) options.search = search as string;
      if (start_date) options.start_date = new Date(start_date as string);
      if (end_date) options.end_date = new Date(end_date as string);
      options.page = parseInt(page as string);
      options.limit = parseInt(limit as string);

      const result = await Alert.findByUserId(userId, options);

      ResponseHelper.successWithPagination(res, result.data, {
        page: result.page,
        limit: result.limit,
        total: result.total
      });
    } catch (error) {
      logger.error('Error fetching user alerts:', error);
      ResponseHelper.internalError(res, 'Failed to fetch alerts');
    }
  }
);

// Get specific alert by ID
router.get('/:id',
  authenticate,
  sanitizeParameters,
  validate(alertSchemas.getById),
  async (req: Request, res: Response) => {
    try {
      // Alert is attached by verifyAlertOwnership middleware
      const alert = (req as any).alert;
      ResponseHelper.success(res, { alert });
    } catch (error) {
      logger.error('Error fetching alert:', error);
      ResponseHelper.internalError(res, 'Failed to fetch alert');
    }
  }
);

// Mark alert as read
router.patch('/:id/read',
  authenticate,
  validate(alertSchemas.markAsRead),
  async (req: Request, res: Response) => {
    try {
      const alertId = req.params.id!;
      const success = await Alert.markAsRead(alertId);

      if (!success) {
        ResponseHelper.internalError(res, 'Failed to mark alert as read');
        return;
      }

      ResponseHelper.success(res, {
        message: 'Alert marked as read',
        alertId
      });
    } catch (error) {
      logger.error('Error marking alert as read:', error);
      ResponseHelper.internalError(res, 'Failed to mark alert as read');
    }
  }
);

// Mark alert as clicked
router.patch('/:id/clicked',
  authenticate,
  validate(alertSchemas.getById),
  async (req: Request, res: Response) => {
    try {
      const alertId = req.params.id!;
      const success = await Alert.markAsClicked(alertId);

      if (!success) {
        ResponseHelper.internalError(res, 'Failed to mark alert as clicked');
        return;
      }

      ResponseHelper.success(res, {
        message: 'Alert marked as clicked',
        alertId
      });
    } catch (error) {
      logger.error('Error marking alert as clicked:', error);
      ResponseHelper.internalError(res, 'Failed to mark alert as clicked');
    }
  }
);

// Bulk mark alerts as read
router.patch('/bulk/read',
  authenticate,
  validate(alertSchemas.bulkMarkAsRead),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { alertIds } = req.body;

      // Verify all alerts belong to user - more efficient query
      const userAlertCount = await Alert['db'](Alert.getTableName())
        .whereIn('id', alertIds)
        .where('user_id', userId)
        .count('* as count');

      const userOwnedCount = parseInt((userAlertCount[0] as any)?.count as string || '0');
      
      if (userOwnedCount !== alertIds.length) {
        ResponseHelper.error(res, 'INVALID_ALERTS', 'Some alerts do not exist or access is denied', 403);
        return;
      }

      const updatedCount = await Alert.bulkMarkAsRead(alertIds);

      ResponseHelper.success(res, {
        message: `${updatedCount} alerts marked as read`,
        updatedCount
      });
    } catch (error) {
      logger.error('Error bulk marking alerts as read:', error);
      ResponseHelper.internalError(res, 'Failed to mark alerts as read');
    }
  }
);

// Delete alert
router.delete('/:id',
  authenticate,
  sanitizeParameters,
  validate(alertSchemas.deleteAlert),
  async (req: Request, res: Response) => {
    try {
      const alertId = req.params.id!;
      const success = await Alert.deleteById(alertId);

      if (!success) {
        ResponseHelper.internalError(res, 'Failed to delete alert');
        return;
      }

      ResponseHelper.success(res, {
        message: 'Alert deleted successfully',
        alertId
      });
    } catch (error) {
      logger.error('Error deleting alert:', error);
      ResponseHelper.internalError(res, 'Failed to delete alert');
    }
  }
);

// Get alert statistics for user
router.get('/stats/summary',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const stats = await Alert.getUserAlertStats(userId);

      ResponseHelper.success(res, { stats });
    } catch (error) {
      logger.error('Error fetching alert stats:', error);
      ResponseHelper.internalError(res, 'Failed to fetch alert statistics');
    }
  }
);

// Get alert analytics (engagement metrics)
router.get('/analytics/engagement',
  authenticate,
  validate(alertSchemas.getAnalytics),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const days = parseInt(req.query.days as string) || 30;
      
      const analytics = await AlertAnalyticsService.getUserAnalytics(userId, days);
      ResponseHelper.success(res, { analytics });
    } catch (error) {
      logger.error('Error fetching alert analytics:', error);
      ResponseHelper.internalError(res, 'Failed to fetch alert analytics');
    }
  }
);

export default router;