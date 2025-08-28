import express from 'express';
import { authenticate } from '../middleware/auth';
import { generalRateLimit } from '../middleware/rateLimiter';
import { validateBody, subscriptionSchemas } from '../validators';
import {
  getPlans,
  getSubscriptionStatus,
  createCheckoutSession,
  cancelSubscription,
  reactivateSubscription,
  getBillingHistory,
  getUsageStats,
  handleStripeWebhook,
  getConversionAnalytics
} from '../controllers/subscriptionController';

const router = express.Router();

// Public routes
router.get('/plans', generalRateLimit, getPlans);

// Webhook route (no auth required, but should be secured by Stripe signature verification)
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);

// Protected routes
router.use(authenticate); // Apply authentication middleware to all routes below

router.get('/status', generalRateLimit, getSubscriptionStatus);
router.get('/usage', generalRateLimit, getUsageStats);
router.get('/billing-history', generalRateLimit, getBillingHistory);

router.post('/checkout', generalRateLimit, validateBody(subscriptionSchemas.createCheckoutSession), createCheckoutSession);
router.post('/cancel', generalRateLimit, validateBody(subscriptionSchemas.cancelSubscription), cancelSubscription);
router.post('/reactivate', generalRateLimit, reactivateSubscription);

// Admin routes (in a real implementation, you would add admin middleware)
router.get('/analytics/conversion', generalRateLimit, getConversionAnalytics);

export default router;