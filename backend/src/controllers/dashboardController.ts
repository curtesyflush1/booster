import { Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../types/express';
import { DashboardService } from '../services/dashboardService';
import { handleControllerError, sendSuccessResponse, sendErrorResponse } from '../utils/controllerHelpers';
import { DASHBOARD_TIME_WINDOWS } from '../constants';

/**
 * Get comprehensive dashboard data for the authenticated user
 */
export const getDashboardData = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const startTime = Date.now();
  
  try {
    const userId = req.user.id;
    const dashboardData = await DashboardService.getDashboardData(userId);

    logger.info('Dashboard data retrieved', {
      userId,
      watchCount: dashboardData.stats.totalWatches,
      duration: Date.now() - startTime,
      correlationId: req.headers['x-correlation-id']
    });

    sendSuccessResponse(res, { dashboard: dashboardData });
  } catch (error) {
    handleControllerError(error, req, next, 'getDashboardData');
  }
};

/**
 * Get predictive insights for user's watched products
 * @param req - Authenticated request with optional productIds query parameter
 * @param res - Express response object
 * @param next - Express next function for error handling
 * @returns Promise<void>
 * @example
 * GET /api/dashboard/insights?productIds=prod1,prod2,prod3
 */
export const getPredictiveInsights = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id;
    const { productIds } = req.query;

    const targetProductIds = parseProductIds(productIds);
    const insights = await DashboardService.getPredictiveInsights(userId, targetProductIds);

    sendSuccessResponse(res, { insights });
  } catch (error) {
    handleControllerError(error, req, next, 'getPredictiveInsights');
  }
};

/**
 * Get portfolio tracking data including collection value and performance metrics
 * @param req - Authenticated request object
 * @param res - Express response object
 * @param next - Express next function for error handling
 * @returns Promise<void>
 */
export const getPortfolioData = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id;
    const portfolioData = await DashboardService.getPortfolioData(userId);

    sendSuccessResponse(res, { portfolio: portfolioData });
  } catch (error) {
    handleControllerError(error, req, next, 'getPortfolioData');
  }
};

/**
 * Get real-time dashboard updates since a specific timestamp
 * @param req - Authenticated request with optional since query parameter
 * @param res - Express response object  
 * @param next - Express next function for error handling
 * @returns Promise<void>
 * @example
 * GET /api/dashboard/updates?since=2024-01-01T00:00:00Z
 */
export const getDashboardUpdates = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id;
    const { since } = req.query;

    const sinceDate = parseSinceDate(since);
    const updates = await DashboardService.getDashboardUpdates(userId, sinceDate);

    sendSuccessResponse(res, { updates });
  } catch (error) {
    handleControllerError(error, req, next, 'getDashboardUpdates');
  }
};

// Helper functions for input parsing and validation
const parseProductIds = (productIds: unknown): string[] | undefined => {
  if (!productIds || typeof productIds !== 'string') {
    return undefined;
  }
  
  return productIds.split(',').filter(id => id.trim().length > 0);
};

const parseSinceDate = (since: unknown): Date | undefined => {
  if (!since || typeof since !== 'string') {
    return undefined;
  }
  
  const date = new Date(since);
  if (isNaN(date.getTime())) {
    return undefined;
  }
  
  // Validate date is reasonable (not in future, not more than 30 days ago)
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - DASHBOARD_TIME_WINDOWS.UPDATES_MAX_AGE);
  
  if (date > now || date < thirtyDaysAgo) {
    return undefined;
  }
  
  return date;
};