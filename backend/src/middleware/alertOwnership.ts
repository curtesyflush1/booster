import { Request, Response, NextFunction } from 'express';
import { Alert } from '../models/Alert';
import { ResponseHelper } from '../utils/responseHelpers';
import { logger } from '../utils/logger';



/**
 * Middleware to verify alert ownership and attach alert to request
 */
export const verifyAlertOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const alertId = req.params.id;

    if (!userId) {
      ResponseHelper.error(res, 'AUTHENTICATION_REQUIRED', 'Authentication required', 401);
      return;
    }

    if (!alertId) {
      ResponseHelper.badRequest(res, 'Alert ID is required');
      return;
    }

    const alert = await Alert.findById(alertId);

    if (!alert) {
      ResponseHelper.notFound(res, 'alert');
      return;
    }

    if ((alert as any).user_id !== userId) {
      ResponseHelper.error(res, 'ALERT_ACCESS_DENIED', 'Access denied to this alert', 403);
      return;
    }

    // Attach alert to request for use in route handler
    (req as any).alert = alert;
    next();
  } catch (error) {
    logger.error('Error verifying alert ownership:', error);
    ResponseHelper.internalError(res, 'Failed to verify alert ownership');
  }
};