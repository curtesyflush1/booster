import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';
import {
  getDashboardData,
  getPredictiveInsights,
  getPortfolioData,
  getDashboardUpdates
} from '../controllers/dashboardController';

const router = Router();

// Apply authentication to all dashboard routes
router.use(authenticateToken);

// Apply rate limiting to dashboard routes
const dashboardLimiter = rateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: 'Too many dashboard requests, please try again later'
});

router.use(dashboardLimiter);

/**
 * @route GET /api/dashboard
 * @desc Get comprehensive dashboard data
 * @access Private
 */
router.get('/', getDashboardData);

/**
 * @route GET /api/dashboard/insights
 * @desc Get predictive insights for watched products
 * @access Private
 */
router.get('/insights', getPredictiveInsights);

/**
 * @route GET /api/dashboard/portfolio
 * @desc Get portfolio tracking data
 * @access Private
 */
router.get('/portfolio', getPortfolioData);

/**
 * @route GET /api/dashboard/updates
 * @desc Get real-time dashboard updates
 * @access Private
 */
router.get('/updates', getDashboardUpdates);

export default router;