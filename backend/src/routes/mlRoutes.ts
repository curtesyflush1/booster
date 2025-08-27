import { Router } from 'express';
import { MLController } from '../controllers/mlController';
import { authenticate } from '../middleware/auth';
import { createRateLimit } from '../middleware/rateLimiter';

const router = Router();

// Apply authentication to all ML routes
router.use(authenticate);

// Apply rate limiting for ML endpoints (more restrictive due to computational cost)
const mlRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 20, // Limit each IP to 20 requests per windowMs
  message: 'Too many ML prediction requests, please try again later'
});

router.use(mlRateLimit);

// Individual product ML endpoints
router.get('/products/:productId/price-prediction', MLController.getPricePrediction);
router.get('/products/:productId/sellout-risk', MLController.getSelloutRisk);
router.get('/products/:productId/roi-estimate', MLController.getROIEstimate);
router.get('/products/:productId/hype-meter', MLController.getHypeMeter);
router.get('/products/:productId/market-insights', MLController.getMarketInsights);
router.get('/products/:productId/analysis', MLController.getComprehensiveAnalysis);

// Aggregate ML endpoints
router.get('/trending-products', MLController.getTrendingProducts);
router.get('/high-risk-products', MLController.getHighRiskProducts);

export default router;