import { Router } from 'express';
import { MLController } from '../controllers/mlController';
import { authenticate, requirePlan } from '../middleware/auth';
import { TOP_TIER_PLAN_SLUGS } from '../services/subscriptionService';
import { createRateLimit } from '../middleware/rateLimiter';
import { sanitizeParameters } from '../middleware/parameterSanitization';
import { validate, mlSchemas } from '../validators';
import { INTERVALS, RATE_LIMITS } from '../constants';

const router = Router();

// Apply authentication to all ML routes
router.use(authenticate);
// Highest tier access only, centralized in subscriptionService
router.use(requirePlan(TOP_TIER_PLAN_SLUGS));

// Apply rate limiting for ML endpoints (more restrictive due to computational cost)
const mlRateLimit = createRateLimit({
  windowMs: INTERVALS.RATE_LIMIT_WINDOW_MEDIUM,
  maxRequests: RATE_LIMITS.ML_MAX_REQUESTS,
  message: 'Too many ML prediction requests, please try again later'
});

router.use(mlRateLimit);

// Individual product ML endpoints
router.get('/products/:productId/price-prediction', sanitizeParameters, validate(mlSchemas.getPricePrediction), MLController.getPricePrediction);
router.get('/products/:productId/sellout-risk', sanitizeParameters, validate(mlSchemas.getSelloutRisk), MLController.getSelloutRisk);
router.get('/products/:productId/roi-estimate', sanitizeParameters, validate(mlSchemas.getROIEstimate), MLController.getROIEstimate);
router.get('/products/:productId/hype-meter', sanitizeParameters, validate(mlSchemas.getHypeMeter), MLController.getHypeMeter);
router.get('/products/:productId/market-insights', sanitizeParameters, validate(mlSchemas.getMarketInsights), MLController.getMarketInsights);
router.get('/products/:productId/analysis', sanitizeParameters, validate(mlSchemas.getComprehensiveAnalysis), MLController.getComprehensiveAnalysis);

// Aggregate ML endpoints
router.get('/trending-products', validate(mlSchemas.getTrendingProducts), MLController.getTrendingProducts);
router.get('/high-risk-products', validate(mlSchemas.getHighRiskProducts), MLController.getHighRiskProducts);

export default router;
