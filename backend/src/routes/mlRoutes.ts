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

// Allow Pro (limited) or Premium (full) access helper
const requireProOrPremium = (req: any, res: any, next: any) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required', timestamp: new Date().toISOString() } });
  }
  const planId = (user as any).subscription_plan_id || '';
  const tier = (user as any).subscription_tier || '';
  const proPlans = ['pro-monthly', 'pro-yearly'];
  if (tier === 'pro' || proPlans.includes(String(planId)) || TOP_TIER_PLAN_SLUGS.includes(String(planId))) {
    return next();
  }
  return res.status(403).json({ error: { code: 'INSUFFICIENT_PLAN', message: 'Pro or Premium plan required for this endpoint', timestamp: new Date().toISOString() } });
};

// Apply rate limiting for ML endpoints (more restrictive due to computational cost)
const mlRateLimit = createRateLimit({
  windowMs: INTERVALS.RATE_LIMIT_WINDOW_MEDIUM,
  maxRequests: RATE_LIMITS.ML_MAX_REQUESTS,
  message: 'Too many ML prediction requests, please try again later'
});

router.use(mlRateLimit);

// Individual product ML endpoints
// Premium-only (full predictions)
router.get('/products/:productId/price-prediction', requirePlan(TOP_TIER_PLAN_SLUGS), sanitizeParameters, validate(mlSchemas.getPricePrediction), MLController.getPricePrediction);
// Pro or Premium (limited for Pro)
router.get('/products/:productId/sellout-risk', requireProOrPremium, sanitizeParameters, validate(mlSchemas.getSelloutRisk), MLController.getSelloutRisk);
// Premium-only
router.get('/products/:productId/roi-estimate', requirePlan(TOP_TIER_PLAN_SLUGS), sanitizeParameters, validate(mlSchemas.getROIEstimate), MLController.getROIEstimate);
// Pro or Premium
router.get('/products/:productId/hype-meter', requireProOrPremium, sanitizeParameters, validate(mlSchemas.getHypeMeter), MLController.getHypeMeter);
// Premium-only (full history)
router.get('/products/:productId/market-insights', requirePlan(TOP_TIER_PLAN_SLUGS), sanitizeParameters, validate(mlSchemas.getMarketInsights), MLController.getMarketInsights);
// Premium-only (comprehensive)
router.get('/products/:productId/analysis', requirePlan(TOP_TIER_PLAN_SLUGS), sanitizeParameters, validate(mlSchemas.getComprehensiveAnalysis), MLController.getComprehensiveAnalysis);

// Drop predictions (Premium-only)
router.get('/drop-predictions', requirePlan(TOP_TIER_PLAN_SLUGS), sanitizeParameters, validate(mlSchemas.getDropPredictions), MLController.getDropPredictions);

// Aggregate ML endpoints
// Premium-only aggregates
router.get('/trending-products', requirePlan(TOP_TIER_PLAN_SLUGS), validate(mlSchemas.getTrendingProducts), MLController.getTrendingProducts);
router.get('/high-risk-products', requirePlan(TOP_TIER_PLAN_SLUGS), validate(mlSchemas.getHighRiskProducts), MLController.getHighRiskProducts);

export default router;
