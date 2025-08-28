import { Router } from 'express';
import { PriceComparisonController } from '../controllers/priceComparisonController';
import { authenticate } from '../middleware/auth';
import { createRateLimit } from '../middleware/rateLimiter';

const router = Router();

// Public routes (with rate limiting)
router.get(
  '/products/:productId',
  createRateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 100 }), // 100 requests per 15 minutes
  PriceComparisonController.getProductComparison
);

router.post(
  '/products/batch',
  createRateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 20 }), // 20 batch requests per 15 minutes
  PriceComparisonController.getBatchComparisons
);

router.get(
  '/products/:productId/history',
  createRateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 50 }), // 50 requests per 15 minutes
  PriceComparisonController.getProductPriceHistory
);

router.get(
  '/deals',
  createRateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 30 }), // 30 requests per 15 minutes
  PriceComparisonController.getCurrentDeals
);

router.get(
  '/products/:productId/trends',
  createRateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 50 }), // 50 requests per 15 minutes
  PriceComparisonController.getProductTrends
);

// Authenticated routes
router.get(
  '/my-deals',
  authenticate,
  createRateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 60 }), // 60 requests per 15 minutes for authenticated users
  PriceComparisonController.getUserDeals
);

export default router;