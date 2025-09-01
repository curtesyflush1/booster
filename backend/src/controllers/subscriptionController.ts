import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { SubscriptionService } from '../services/subscriptionService';
import { User } from '../models/User';
import { IUser } from '../types/database';
import { logger } from '../utils/logger';
import { billingEventService } from '../services/billingEventService';

// Validation schemas
const createCheckoutSessionSchema = Joi.object({
  planSlug: Joi.string().valid('free', 'pro', 'pro-monthly', 'pro-yearly', 'premium', 'premium-monthly').required().messages({
    'any.only': 'Plan must be one of "free", "pro", "pro-monthly", "pro-yearly", "premium", or "premium-monthly"',
    'any.required': 'Plan slug is required'
  }),
  successUrl: Joi.string().uri().required().messages({
    'string.uri': 'Success URL must be a valid URL',
    'any.required': 'Success URL is required'
  }),
  cancelUrl: Joi.string().uri().required().messages({
    'string.uri': 'Cancel URL must be a valid URL',
    'any.required': 'Cancel URL is required'
  })
});

const cancelSubscriptionSchema = Joi.object({
  cancelAtPeriodEnd: Joi.boolean().default(true)
});

/**
 * Get all active subscription plans
 */
export const getPlans = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const plans = await SubscriptionService.getActivePlans();

    res.json({
      plans
    });
  } catch (error) {
    logger.error('Error fetching subscription plans:', error);
    next(error);
  }
};

/**
 * Get current user's subscription status
 */
export const getSubscriptionStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const user = await User.findById<IUser>(req.user.id);
    if (!user) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Get usage stats and quota information (temporarily disabled for development)
    // const quotaCheck = await SubscriptionService.checkQuota(user.id, 'watch_created');
    // const billingHistory = await SubscriptionService.getBillingHistory(user.id, 5);
    
    // Temporary mock data for development
    const quotaCheck = { allowed: true, limit: 5, used: 0, remaining: 5 };
    const billingHistory = [];

    res.json({
      subscription: {
        tier: user.subscription_tier,
        status: user.subscription_status,
        subscriptionId: user.subscription_id,
        planId: user.subscription_plan_id,
        startDate: user.subscription_start_date,
        endDate: user.subscription_end_date,
        trialEndDate: user.trial_end_date,
        cancelAtPeriodEnd: user.cancel_at_period_end,
        stripeCustomerId: user.stripe_customer_id
      },
      usage: user.usage_stats,
      quota: quotaCheck,
      billingHistory
    });
  } catch (error) {
    logger.error('Error fetching subscription status:', error);
    next(error);
  }
};

/**
 * Create Stripe checkout session for subscription upgrade
 */
export const createCheckoutSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Validate request body
    const { error, value } = createCheckoutSessionSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details?.[0]?.message || 'Validation failed',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    let { planSlug, successUrl, cancelUrl } = value;
    // Backward compatibility: treat 'pro' as 'pro-monthly' and 'premium' as 'premium-monthly'
    if (planSlug === 'pro') planSlug = 'pro-monthly';
    if (planSlug === 'premium') planSlug = 'premium-monthly';

    // Check if user already has an active subscription
    const user = await User.findById<IUser>(req.user.id);
    if (user?.subscription_tier === 'pro' && user.subscription_status === 'active') {
      res.status(400).json({
        error: {
          code: 'ALREADY_SUBSCRIBED',
          message: 'User already has an active Pro subscription',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Record conversion analytics
    await SubscriptionService.recordConversionEvent(req.user.id, 'upgrade_clicked');

    const session = await SubscriptionService.createCheckoutSession(
      req.user.id,
      planSlug,
      successUrl,
      cancelUrl
    );

    res.json({
      sessionId: session.sessionId,
      url: session.url
    });
  } catch (error) {
    logger.error('Error creating checkout session:', error);
    next(error);
  }
};

/**
 * Cancel subscription
 */
export const cancelSubscription = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Validate request body
    const { error, value } = cancelSubscriptionSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details?.[0]?.message || 'Validation failed',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const { cancelAtPeriodEnd } = value;

    const success = await SubscriptionService.cancelSubscription(req.user.id, cancelAtPeriodEnd);

    if (!success) {
      res.status(400).json({
        error: {
          code: 'CANCELLATION_FAILED',
          message: 'Failed to cancel subscription',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    res.json({
      message: cancelAtPeriodEnd 
        ? 'Subscription will be canceled at the end of the current billing period'
        : 'Subscription canceled immediately',
      cancelAtPeriodEnd
    });
  } catch (error) {
    logger.error('Error canceling subscription:', error);
    next(error);
  }
};

/**
 * Reactivate subscription
 */
export const reactivateSubscription = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const success = await SubscriptionService.reactivateSubscription(req.user.id);

    if (!success) {
      res.status(400).json({
        error: {
          code: 'REACTIVATION_FAILED',
          message: 'Failed to reactivate subscription',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    res.json({
      message: 'Subscription reactivated successfully'
    });
  } catch (error) {
    logger.error('Error reactivating subscription:', error);
    next(error);
  }
};

/**
 * Get user's billing history
 */
export const getBillingHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 10;
    const billingHistory = await SubscriptionService.getBillingHistory(req.user.id, limit);

    res.json({
      billingHistory
    });
  } catch (error) {
    logger.error('Error fetching billing history:', error);
    next(error);
  }
};

/**
 * Get usage statistics
 */
export const getUsageStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const user = await User.findById<IUser>(req.user.id);
    if (!user) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Get quota information for different usage types
    const watchQuota = await SubscriptionService.checkQuota(user.id, 'watch_created');
    const alertQuota = await SubscriptionService.checkQuota(user.id, 'alert_sent');
    const apiQuota = await SubscriptionService.checkQuota(user.id, 'api_call');

    res.json({
      usage: user.usage_stats,
      quotas: {
        watches: watchQuota,
        alerts: alertQuota,
        apiCalls: apiQuota
      },
      subscriptionTier: user.subscription_tier
    });
  } catch (error) {
    logger.error('Error fetching usage stats:', error);
    next(error);
  }
};

/**
 * Webhook handler for Stripe events
 */
export const handleStripeWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sig = req.headers['stripe-signature'] as string;
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const stripeSecret = process.env.STRIPE_SECRET_KEY;

    let event: any;
    if (endpointSecret && stripeSecret && Buffer.isBuffer(req.body)) {
      try {
        const stripe = new (require('stripe'))(stripeSecret);
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      } catch (err) {
        logger.error('Webhook signature verification failed:', err as any);
        res.status(400).send('Webhook signature verification failed');
        return;
      }
    } else {
      // Fallback: parse JSON without signature verification (dev only)
      try {
        event = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString('utf8')) : req.body;
      } catch (err) {
        logger.error('Failed to parse webhook body:', err as any);
        res.status(400).send('Invalid webhook payload');
        return;
      }
    }

    // Handle the event
    switch (event.type) {
      case 'customer.subscription.created':
        await SubscriptionService.handleSubscriptionCreated(event.data.object);
        try {
          await billingEventService.recordAndEmit({
            stripe_customer_id: event.data.object.customer,
            subscription_id: event.data.object.id,
            event_type: event.type,
            status: event.data.object.status,
            raw_event: event
          });
        } catch (e) { logger.warn('Failed to record billing event', { type: event.type }); }
        break;
      case 'customer.subscription.updated':
        // Handle subscription updates
        logger.info('Subscription updated:', event.data.object.id);
        try {
          await billingEventService.recordAndEmit({
            stripe_customer_id: event.data.object.customer,
            subscription_id: event.data.object.id,
            event_type: event.type,
            status: event.data.object.status,
            raw_event: event
          });
        } catch (e) { logger.warn('Failed to record billing event', { type: event.type }); }
        break;
      case 'customer.subscription.deleted':
        // Handle subscription cancellation
        logger.info('Subscription deleted:', event.data.object.id);
        try {
          await billingEventService.recordAndEmit({
            stripe_customer_id: event.data.object.customer,
            subscription_id: event.data.object.id,
            event_type: event.type,
            status: event.data.object.status,
            raw_event: event
          });
        } catch (e) { logger.warn('Failed to record billing event', { type: event.type }); }
        break;
      case 'invoice.payment_succeeded':
        // Handle successful payment
        logger.info('Payment succeeded:', event.data.object.id);
        try {
          await billingEventService.recordAndEmit({
            stripe_customer_id: event.data.object.customer,
            subscription_id: event.data.object.subscription,
            event_type: event.type,
            amount_cents: event.data.object.amount_paid,
            currency: event.data.object.currency,
            status: 'succeeded',
            invoice_id: event.data.object.id,
            occurred_at: new Date(event.created * 1000),
            raw_event: event
          });
        } catch (e) { logger.warn('Failed to record billing event', { type: event.type }); }
        break;
      case 'invoice.payment_failed':
        // Handle failed payment
        logger.info('Payment failed:', event.data.object.id);
        try {
          await billingEventService.recordAndEmit({
            stripe_customer_id: event.data.object.customer,
            subscription_id: event.data.object.subscription,
            event_type: event.type,
            amount_cents: event.data.object.amount_due,
            currency: event.data.object.currency,
            status: 'failed',
            invoice_id: event.data.object.id,
            occurred_at: new Date(event.created * 1000),
            raw_event: event
          });
        } catch (e) { logger.warn('Failed to record billing event', { type: event.type }); }
        break;
      default:
        logger.info(`Unhandled event type: ${event.type}`);
        try {
          await billingEventService.recordAndEmit({
            stripe_customer_id: event.data?.object?.customer || 'unknown',
            subscription_id: event.data?.object?.subscription || null,
            event_type: event.type,
            status: event.data?.object?.status || null,
            raw_event: event
          });
        } catch {}
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Error handling Stripe webhook:', error);
    next(error);
  }
};

/**
 * Get conversion analytics (admin only)
 */
export const getConversionAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // In a real implementation, you would check for admin permissions
    const days = parseInt(req.query.days as string) || 30;
    const analytics = await SubscriptionService.getConversionAnalytics(days);

    res.json({
      analytics,
      period: `${days} days`
    });
  } catch (error) {
    logger.error('Error fetching conversion analytics:', error);
    next(error);
  }
};
