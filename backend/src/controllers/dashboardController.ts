import { Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../types/express';
import { DashboardService } from '../services/dashboardService';
import { handleControllerError, sendSuccessResponse } from '../utils/controllerHelpers';
import { parseProductIds, parseSinceDate } from '../utils/dashboardValidation';

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
 * Get consolidated dashboard data including all dashboard, portfolio, and insights data in a single call
 * This reduces the number of API requests from 3 to 1 for better performance
 */
export const getConsolidatedDashboardData = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const startTime = Date.now();
  
  try {
    const userId = req.user.id;
    const { productIds } = req.query;

    // Parse optional product IDs for insights with proper validation
    const targetProductIds = parseProductIds(productIds);

    // Fetch all dashboard data in parallel for optimal performance
    const [dashboardData, portfolioData, insightsData] = await Promise.all([
      DashboardService.getDashboardData(userId),
      DashboardService.getPortfolioData(userId),
      DashboardService.getPredictiveInsights(userId, targetProductIds)
    ]);

    const consolidatedData = {
      dashboard: dashboardData,
      portfolio: portfolioData,
      insights: insightsData,
      timestamp: new Date().toISOString()
    };

    logger.info('Consolidated dashboard data retrieved', {
      userId,
      watchCount: dashboardData.stats.totalWatches,
      portfolioItems: portfolioData.totalItems,
      insightsCount: insightsData.length,
      duration: Date.now() - startTime,
      correlationId: req.headers['x-correlation-id']
    });

    sendSuccessResponse(res, consolidatedData);
  } catch (error) {
    handleControllerError(error, req, next, 'getConsolidatedDashboardData');
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

