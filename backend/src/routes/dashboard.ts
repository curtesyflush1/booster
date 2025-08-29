import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { createRateLimit } from '../middleware/rateLimiter';
import { validate, dashboardSchemas } from '../validators';
import { INTERVALS, RATE_LIMITS } from '../constants';
import {
  getDashboardData,
  getConsolidatedDashboardData,
  getPredictiveInsights,
  getPortfolioData,
  getDashboardUpdates
} from '../controllers/dashboardController';

const router = Router();

// Apply authentication to all dashboard routes
router.use(authenticate);

// Apply rate limiting to dashboard routes
const dashboardLimiter = createRateLimit({
  windowMs: INTERVALS.RATE_LIMIT_WINDOW_SHORT,
  maxRequests: RATE_LIMITS.DASHBOARD_MAX_REQUESTS,
  message: 'Too many dashboard requests, please try again later'
});

router.use(dashboardLimiter);

/**
 * @route GET /api/dashboard
 * @desc Get comprehensive dashboard data
 * @access Private
 */
router.get('/', getDashboardData as any);

/**
 * @route GET /api/dashboard/consolidated
 * @desc Get all dashboard data (dashboard, portfolio, insights) in a single call
 * @access Private
 */
router.get('/consolidated', validate(dashboardSchemas.getStats), getConsolidatedDashboardData as any);

/**
 * @route GET /api/dashboard/insights
 * @desc Get predictive insights for watched products
 * @access Private
 */
router.get('/insights', validate(dashboardSchemas.getStats), getPredictiveInsights as any);

/**
 * @route GET /api/dashboard/portfolio
 * @desc Get portfolio tracking data
 * @access Private
 */
router.get('/portfolio', getPortfolioData as any);

/**
 * @route GET /api/dashboard/updates
 * @desc Get real-time dashboard updates
 * @access Private
 */
router.get('/updates', validate(dashboardSchemas.getAlerts), getDashboardUpdates as any);

export default router;