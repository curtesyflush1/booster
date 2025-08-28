import { Router } from 'express';
import { PriceComparisonController } from '../controllers/priceComparisonController';
import { authenticate } from '../middleware/auth';
import { createRateLimit } from '../middleware/rateLimiter';
import { INTERVALS, RATE_LIMITS } from '../constants';

const router = Router();

// Public routes (with rate limiting)
router.get(
  '/products/:productId',
  createRateLimit({ windowMs: INTERVALS.RATE_LIMIT_WINDOW_MEDIUM, maxRequests: RATE_LIMITS.PRICE_COMPARISON_MAX_REQUESTS }),
  PriceComparisonController.getProductComparison
);

router.post(
  '/products/batch',
  createRateLimit({ windowMs: INTERVALS.RATE_LIMIT_WINDOW_MEDIUM, maxRequests: RATE_LIMITS.PRICE_COMPARISON_BATCH_MAX_REQUESTS }),
  PriceComparisonController.getBatchComparisons
);

router.get(
  '/products/:productId/history',
  createRateLimit({ windowMs: INTERVALS.RATE_LIMIT_WINDOW_MEDIUM, maxRequests: RATE_LIMITS.PRICE_COMPARISON_HISTORY_MAX_REQUESTS }),
  PriceComparisonController.getProductPriceHistory
);

router.get(
  '/deals',
  createRateLimit({ windowMs: INTERVALS.RATE_LIMIT_WINDOW_MEDIUM, maxRequests: RATE_LIMITS.PRICE_COMPARISON_DEALS_MAX_REQUESTS }),
  PriceComparisonController.getCurrentDeals
);

router.get(
  '/products/:productId/trends',
  createRateLimit({ windowMs: INTERVALS.RATE_LIMIT_WINDOW_MEDIUM, maxRequests: RATE_LIMITS.PRICE_COMPARISON_TRENDS_MAX_REQUESTS }),
  PriceComparisonController.getProductTrends
);

// Authenticated routes
router.get(
  '/my-deals',
  authenticate,
  createRateLimit({ windowMs: INTERVALS.RATE_LIMIT_WINDOW_MEDIUM, maxRequests: RATE_LIMITS.PRICE_COMPARISON_USER_DEALS_MAX_REQUESTS }),
  PriceComparisonController.getUserDeals
);

export default router;