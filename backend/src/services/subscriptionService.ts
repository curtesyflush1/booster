import Stripe from 'stripe';
import { User } from '../models/User';
import { BaseModel } from '../models/BaseModel';
import { IUser, IUsageStats } from '../types/database';
import { SubscriptionTier } from '../types/subscription';
import { logger } from '../utils/logger';

// Initialize Stripe using environment configuration
const stripeSecret = process.env.STRIPE_SECRET_KEY || '';
// Always initialize Stripe in tests (module is usually mocked), and when a secret is provided.
// This keeps production strict but unblocks unit tests without env configuration.
const stripe = (process.env.NODE_ENV === 'test' || stripeSecret)
  ? new Stripe((stripeSecret || 'sk_test_dummy') as string)
  : (null as any);

// ------------------------------
// Centralized Plan Policy Config
// ------------------------------
export type PlanPolicy = {
  slug: string;
  label: string;
  mlEnabled: boolean;
  // History window in days; -1 means unlimited
  historyDays: number;
  // Notification channel access
  channels: {
    sms: boolean;
    discord: boolean;
  };
};

export const PLAN_POLICIES: Record<string, PlanPolicy> = {
  'free': {
    slug: 'free',
    label: 'Free',
    mlEnabled: false,
    historyDays: 30,
    channels: { sms: false, discord: false },
  },
  'pro-monthly': {
    slug: 'pro-monthly',
    label: 'Pro (Monthly)',
    mlEnabled: true, // limited ML allowed
    historyDays: 365,
    channels: { sms: true, discord: true },
  },
  'pro-yearly': {
    slug: 'pro-yearly',
    label: 'Pro (Yearly)',
    mlEnabled: true,
    historyDays: -1, // unlimited
    channels: { sms: true, discord: true },
  },
  'premium-monthly': {
    slug: 'premium-monthly',
    label: 'Premium',
    mlEnabled: true,
    historyDays: -1, // unlimited
    channels: { sms: true, discord: true },
  },
  'pro-plus': {
    slug: 'pro-plus',
    label: 'Pro+',
    mlEnabled: true,
    historyDays: -1,
    channels: { sms: true, discord: true },
  }
};

// Map Stripe Price IDs to plan slugs (only include if env var present)
export const STRIPE_PRICE_ID_TO_PLAN_SLUG: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  const pairs: Array<[string | undefined, string]> = [
    [process.env.STRIPE_PRO_MONTHLY_PRICE_ID, 'pro-monthly'],
    [process.env.STRIPE_PRO_YEARLY_PRICE_ID, 'pro-yearly'],
    [process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID, 'premium-monthly'],
    [process.env.STRIPE_PRO_PLUS_PRICE_ID, 'pro-plus'],
  ];
  for (const [priceId, slug] of pairs) {
    if (priceId && priceId.trim().length > 0) {
      map[priceId] = slug;
    }
  }
  return map;
})();

export function getPlanSlugForPriceId(priceId?: string): string | undefined {
  if (!priceId) return undefined;
  return STRIPE_PRICE_ID_TO_PLAN_SLUG[priceId] || undefined;
}

export function getPlanPolicyForSlug(slug?: string): PlanPolicy {
  if (!slug) return PLAN_POLICIES['free'];
  return PLAN_POLICIES[slug] || PLAN_POLICIES['free'];
}

export function getUserPlanPolicy(user?: Pick<IUser, 'subscription_plan_id' | 'subscription_tier'> | null): PlanPolicy {
  if (!user) return PLAN_POLICIES['free'];
  // Prefer explicit plan slug, then fall back to subscription_tier
  const planSlug = (user.subscription_plan_id || '').toLowerCase();
  if (planSlug && PLAN_POLICIES[planSlug]) return PLAN_POLICIES[planSlug];
  const tier = (user.subscription_tier || '').toLowerCase();
  if (tier === 'pro') return PLAN_POLICIES['pro-monthly'];
  return PLAN_POLICIES['free'];
}

// Useful list for gating ML endpoints
export const TOP_TIER_PLAN_SLUGS = ['premium-monthly', 'pro-yearly', 'pro-plus'];

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  billing_period: 'monthly' | 'yearly';
  stripe_price_id: string;
  features: string[];
  limits: {
    max_watches: number | null;
    max_alerts_per_day: number | null;
    api_rate_limit: number | null;
  };
  is_active: boolean;
  trial_days: number;
}

export interface UsageStats {
  watches_used: number;
  alerts_sent: number;
  api_calls: number;
  last_reset: string | null;
}

export interface BillingEvent {
  id: string;
  user_id: string;
  event_type: string;
  stripe_event_id?: string;
  event_data: Record<string, any>;
  amount?: number;
  currency: string;
  event_date: Date;
}

export class SubscriptionService extends BaseModel<any> {
  protected static override tableName = 'subscription_plans';

  // Required by BaseModel but not used for this service
  validate(): any[] { return []; }
  sanitize(data: any): any { return data; }

  // Get all active subscription plans
  static async getActivePlans(): Promise<SubscriptionPlan[]> {
    try {
      const plans = await this.db('subscription_plans')
        .where('is_active', true)
        .orderBy('price', 'asc');
      
      const normalized = plans.map(plan => ({
        ...plan,
        features: typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features,
        limits: typeof plan.limits === 'string' ? JSON.parse(plan.limits) : plan.limits
      }));

      // If database has no plans yet, provide sensible defaults to avoid 500s
      if (!normalized || normalized.length === 0) {
        return this.getDefaultPlans();
      }

      return normalized;
    } catch (error) {
      logger.error('Error fetching subscription plans:', error);
      // Fallback to defaults when table doesn't exist or any fetch failure occurs
      return this.getDefaultPlans();
    }
  }

  // Default plans used as a fallback when DB is not ready
  private static getDefaultPlans(): SubscriptionPlan[] {
    return [
      {
        id: 'pro-monthly',
        name: 'Pro',
        slug: 'pro-monthly',
        description: 'Advanced features with limited auto-purchase and ML insights',
        price: 40.0,
        billing_period: 'monthly',
        stripe_price_id: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || 'price_pro_monthly',
        features: [
          'Up to 10 product watches',
          'Higher alert priority',
          'SMS & Discord notifications',
          'Auto-purchase (limited capacity)',
          'ML insights (limited: basic price trend + risk)',
          'Extended price history (12 months)',
          'Advanced filtering',
          'Browser extension access'
        ],
        limits: { max_watches: 10, max_alerts_per_day: null, api_rate_limit: null },
        is_active: true,
        trial_days: 7
      },
      {
        id: 'premium-monthly',
        name: 'Premium',
        slug: 'premium-monthly',
        description: 'Full auto-purchase, full ML suite, top queue priority',
        price: 100.0,
        billing_period: 'monthly',
        stripe_price_id: process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID || 'price_premium_monthly',
        features: [
          'Unlimited product watches',
          'Highest queue priority + fastest alerts',
          'Auto-purchase (full capacity & priority)',
          'Full ML suite: price prediction, sellout risk, ROI',
          'Full price history access',
          'Premium support',
          'One-time $300 setup fee'
        ],
        limits: { max_watches: null, max_alerts_per_day: null, api_rate_limit: null },
        is_active: true,
        trial_days: 7
      },
      {
        id: 'free',
        name: 'Free',
        slug: 'free',
        description: 'Basic alerts for casual collectors',
        price: 0.0,
        billing_period: 'monthly',
        stripe_price_id: '',
        features: [
          'Up to 2 product watches',
          'Basic email alerts',
          'Web push notifications',
          'Community support'
        ],
        limits: { max_watches: 2, max_alerts_per_day: 50, api_rate_limit: 1000 },
        is_active: true,
        trial_days: 0
      }
    ];
  }

  // Get plan by slug
  static async getPlanBySlug(slug: string): Promise<SubscriptionPlan | null> {
    try {
      const plan = await this.db('subscription_plans')
        .where({ slug, is_active: true })
        .first();
      
      return plan || null;
    } catch (error) {
      logger.error('Error fetching plan by slug:', error);
      throw error;
    }
  }

  // Create Stripe customer for user
  static async createStripeCustomer(user: IUser): Promise<string> {
    try {
      const customerData: Stripe.CustomerCreateParams = {
        email: user.email,
        metadata: {
          user_id: user.id
        }
      };

      if (user.first_name && user.last_name) {
        customerData.name = `${user.first_name} ${user.last_name}`;
      }

      const customer = await stripe.customers.create(customerData);

      // Update user with Stripe customer ID
      await User.updateById<IUser>(user.id, {
        stripe_customer_id: customer.id
      });

      logger.info('Stripe customer created', { userId: user.id, customerId: customer.id });
      return customer.id;
    } catch (error) {
      logger.error('Error creating Stripe customer:', error);
      throw error;
    }
  }

  // Create subscription checkout session
  static async createCheckoutSession(
    userId: string,
    planSlug: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ sessionId: string; url: string }> {
    try {
      if (!stripe) {
        throw new Error('Stripe is not configured. Missing STRIPE_SECRET_KEY');
      }
      const user = await User.findById<IUser>(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Resolve plan from DB, with graceful fallback to defaults in dev
      let plan: SubscriptionPlan | null = null;
      try {
        plan = await this.getPlanBySlug(planSlug);
      } catch (e) {
        logger.warn('Plan lookup failed; using default plans fallback', {
          error: e instanceof Error ? e.message : String(e),
        });
      }
      if (!plan) {
        const defaults = this.getDefaultPlans();
        plan = defaults.find(p => p.slug === planSlug) || null;
      }
      if (!plan) {
        throw new Error('Plan not found');
      }

      // Create or get Stripe customer
      let customerId = user.stripe_customer_id;
      if (!customerId) {
        customerId = await this.createStripeCustomer(user);
      }

      // Create checkout session
      // Ensure success URL includes the checkout session id for client confirmation
      const successUrlWithSession = (() => {
        try {
          const u = new URL(successUrl);
          if (!u.searchParams.has('session_id')) {
            u.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}');
          }
          return u.toString();
        } catch {
          // Fallback: append query param safely
          return successUrl.includes('?')
            ? `${successUrl}&session_id={CHECKOUT_SESSION_ID}`
            : `${successUrl}?session_id={CHECKOUT_SESSION_ID}`;
        }
      })();

      const sessionData: Stripe.Checkout.SessionCreateParams = {
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [],
        mode: 'subscription',
        success_url: successUrlWithSession,
        cancel_url: cancelUrl,
        metadata: {
          user_id: userId,
          plan_slug: planSlug
        },
        subscription_data: {
          metadata: {
            user_id: userId,
            plan_slug: planSlug
          }
        }
      };

      // Add primary subscription line item (prefer env override if present for safety in dev)
      let primaryPriceId = plan.stripe_price_id;
      if (plan.slug === 'pro-monthly' && process.env.STRIPE_PRO_MONTHLY_PRICE_ID) {
        primaryPriceId = process.env.STRIPE_PRO_MONTHLY_PRICE_ID;
      }
      if (plan.slug === 'premium-monthly' && process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID) {
        primaryPriceId = process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID;
      }
      sessionData.line_items!.push({ price: primaryPriceId, quantity: 1 });

      // Optionally add a one-time setup fee for premium only
      // Use STRIPE_PREMIUM_SETUP_FEE_PRICE_ID to avoid charging setup fee to Pro
      const premiumSetupFeePriceId = process.env.STRIPE_PREMIUM_SETUP_FEE_PRICE_ID || process.env.STRIPE_SETUP_FEE_PRICE_ID;
      if (premiumSetupFeePriceId && plan.slug.startsWith('premium')) {
        sessionData.line_items!.push({ price: premiumSetupFeePriceId, quantity: 1 });
      }

      if (plan.trial_days > 0) {
        sessionData.subscription_data!.trial_period_days = plan.trial_days;
      }

      const session = await stripe.checkout.sessions.create(sessionData);

      logger.info('Checkout session created', { userId, planSlug, sessionId: session.id });
      return {
        sessionId: session.id,
        url: session.url!
      };
    } catch (error) {
      logger.error('Error creating checkout session:', error);
      throw error;
    }
  }

  // Handle successful subscription creation
  static async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    try {
      const userId = subscription.metadata.user_id;
      if (!userId) {
        logger.error('No user_id in subscription metadata');
        return;
      }

      const user = await User.findById<IUser>(userId);
      if (!user) {
        logger.error('User not found for subscription', { userId });
        return;
      }

      // Extract plan/price information and map to internal slug
      const firstItem = subscription.items?.data?.[0];
      const priceId = (firstItem && (firstItem.price as any)?.id) || undefined;
      const planIdentifier: string | undefined = getPlanSlugForPriceId(priceId) || priceId;

      const updateData: Partial<IUser> = {
        subscription_id: subscription.id,
        subscription_status: subscription.status as any,
        // Keep tier as PRO for now to avoid broad changes; planIdentifier differentiates premium
        subscription_tier: SubscriptionTier.PRO,
        ...(planIdentifier ? { subscription_plan_id: planIdentifier } : {})
      };

      if ((subscription as any).current_period_start) {
        updateData.subscription_start_date = new Date((subscription as any).current_period_start * 1000);
      }
      if ((subscription as any).current_period_end) {
        updateData.subscription_end_date = new Date((subscription as any).current_period_end * 1000);
      }
      if (subscription.trial_end) {
        updateData.trial_end_date = new Date(subscription.trial_end * 1000);
      }

      await User.updateById<IUser>(userId, updateData);

      // Record billing event
      await this.recordBillingEvent({
        user_id: userId,
        event_type: 'subscription_created',
        event_data: {
          subscription_id: subscription.id,
          status: subscription.status,
          plan_id: subscription.items.data[0]?.price.id
        },
        amount: subscription.items.data[0]?.price.unit_amount ? subscription.items.data[0].price.unit_amount / 100 : 0,
        currency: subscription.currency.toUpperCase(),
        event_date: new Date()
      });

      // Record conversion analytics
      await this.recordConversionEvent(userId, 'trial_started');

      logger.info('Subscription created successfully', { userId, subscriptionId: subscription.id });
    } catch (error) {
      logger.error('Error handling subscription creation:', error);
      throw error;
    }
  }

  // Handle subscription cancellation
  static async cancelSubscription(userId: string, cancelAtPeriodEnd: boolean = true): Promise<boolean> {
    try {
      const user = await User.findById<IUser>(userId);
      if (!user || !user.subscription_id) {
        throw new Error('No active subscription found');
      }

      if (cancelAtPeriodEnd) {
        // Cancel at period end
        await stripe.subscriptions.update(user.subscription_id, {
          cancel_at_period_end: true
        });

        await User.updateById<IUser>(userId, {
          cancel_at_period_end: true
        });
      } else {
        // Cancel immediately
        await stripe.subscriptions.cancel(user.subscription_id);

        await User.updateById<IUser>(userId, {
          subscription_status: 'canceled',
          subscription_tier: SubscriptionTier.FREE
        });
      }

      // Record billing event
      await this.recordBillingEvent({
        user_id: userId,
        event_type: 'subscription_canceled',
        event_data: {
          subscription_id: user.subscription_id,
          cancel_at_period_end: cancelAtPeriodEnd
        },
        currency: 'USD',
        event_date: new Date()
      });

      // Record conversion analytics
      await this.recordConversionEvent(userId, 'subscription_canceled');

      logger.info('Subscription canceled', { userId, subscriptionId: user.subscription_id, cancelAtPeriodEnd });
      return true;
    } catch (error) {
      logger.error('Error canceling subscription:', error);
      throw error;
    }
  }

  // Reactivate subscription
  static async reactivateSubscription(userId: string): Promise<boolean> {
    try {
      const user = await User.findById<IUser>(userId);
      if (!user || !user.subscription_id) {
        throw new Error('No subscription found');
      }

      // Remove cancel_at_period_end flag
      await stripe.subscriptions.update(user.subscription_id, {
        cancel_at_period_end: false
      });

      await User.updateById<IUser>(userId, {
        cancel_at_period_end: false
      });

      // Record conversion analytics
      await this.recordConversionEvent(userId, 'subscription_reactivated');

      logger.info('Subscription reactivated', { userId, subscriptionId: user.subscription_id });
      return true;
    } catch (error) {
      logger.error('Error reactivating subscription:', error);
      throw error;
    }
  }

  // Track usage for quota management
  static async trackUsage(
    userId: string,
    usageType: 'watch_created' | 'alert_sent' | 'api_call' | 'sms_sent' | 'discord_sent',
    quantity: number = 1,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Record usage
      await this.db('subscription_usage').insert({
        id: this.db.raw('gen_random_uuid()'),
        user_id: userId,
        usage_type: usageType,
        quantity,
        metadata,
        usage_date: today
      });

      // Update user usage stats
      const user = await User.findById<IUser>(userId);
      if (user) {
        const currentStats = user.usage_stats || { watches_used: 0, alerts_sent: 0, api_calls: 0, last_reset: null };
        
        switch (usageType) {
          case 'watch_created':
            currentStats.watches_used += quantity;
            break;
          case 'alert_sent':
          case 'sms_sent':
          case 'discord_sent':
            currentStats.alerts_sent += quantity;
            break;
          case 'api_call':
            currentStats.api_calls += quantity;
            break;
        }

        await User.updateById<IUser>(userId, {
          usage_stats: currentStats
        });
      }

      logger.debug('Usage tracked', { userId, usageType, quantity });
    } catch (error) {
      logger.error('Error tracking usage:', error);
      throw error;
    }
  }

  // Check if user has exceeded quota
  static async checkQuota(userId: string, usageType: string): Promise<{ allowed: boolean; limit?: number; used?: number }> {
    try {
      const user = await User.findById<IUser>(userId);
      if (!user) {
        return { allowed: false };
      }

      // Determine plan-specific limits
      const planSlug = (user.subscription_plan_id || '').toLowerCase();
      const tier = (user.subscription_tier || '').toLowerCase();

      // Compute watch limits per plan
      const resolveWatchLimit = (): number | null => {
        if (planSlug === 'premium-monthly' || planSlug === 'pro-plus') return null; // unlimited
        if (planSlug === 'pro-monthly' || planSlug === 'pro-yearly') return 10;
        if (planSlug === 'free' || tier === 'free') return 2;
        // Fallback by tier
        if (tier === 'pro') return 10;
        return 2;
      };

      if (usageType === 'watch_created') {
        const limit = resolveWatchLimit();
        if (limit === null) return { allowed: true };
        // Count active watches for robust enforcement
        const countResult = await this.db('watches')
          .where({ user_id: userId })
          .where('is_active', true)
          .count('* as count');
        const used = Number(countResult?.[0]?.count || 0);
        return { allowed: used < limit, limit, used };
      }

      // Non-watch quotas (leave defaults unless specified)
      if (user.subscription_tier === SubscriptionTier.FREE) {
        const limits = { alert_sent: 50, api_call: 1000 } as const;
        const limit = limits[usageType as keyof typeof limits];
        if (limit && user.usage_stats) {
          const used = usageType === 'alert_sent' ? (user.usage_stats.alerts_sent || 0) : (user.usage_stats.api_calls || 0);
          return { allowed: used < limit, limit, used };
        }
      }

      return { allowed: true };
    } catch (error) {
      logger.error('Error checking quota:', error);
      return { allowed: false };
    }
  }

  // Get user's billing history
  static async getBillingHistory(userId: string, limit: number = 10): Promise<BillingEvent[]> {
    try {
      const events = await this.db('billing_events')
        .where('user_id', userId)
        .orderBy('event_date', 'desc')
        .limit(limit);

      return events;
    } catch (error) {
      logger.error('Error fetching billing history:', error);
      throw error;
    }
  }

  // Record billing event
  static async recordBillingEvent(eventData: Omit<BillingEvent, 'id'>): Promise<void> {
    try {
      await this.db('billing_events').insert({
        id: this.db.raw('gen_random_uuid()'),
        ...eventData,
        currency: eventData.currency || 'USD'
      });
    } catch (error) {
      logger.error('Error recording billing event:', error);
      throw error;
    }
  }

  // Record conversion analytics event
  static async recordConversionEvent(
    userId: string,
    eventType: string,
    source?: string,
    medium?: string,
    campaign?: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      await this.db('conversion_analytics').insert({
        id: this.db.raw('gen_random_uuid()'),
        user_id: userId,
        event_type: eventType,
        source: source || 'direct',
        medium: medium || 'organic',
        campaign,
        metadata
      });
    } catch (error) {
      logger.error('Error recording conversion event:', error);
      throw error;
    }
  }

  // Get conversion analytics
  static async getConversionAnalytics(days: number = 30): Promise<{
    signups: number;
    trials: number;
    conversions: number;
    cancellations: number;
    conversionRate: number;
  }> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const results = await this.db('conversion_analytics')
        .select('event_type')
        .count('* as count')
        .where('event_date', '>=', startDate)
        .groupBy('event_type');

      const analytics = {
        signups: 0,
        trials: 0,
        conversions: 0,
        cancellations: 0,
        conversionRate: 0
      };

      results.forEach(result => {
        const count = Number(result.count);
        switch (result.event_type) {
          case 'signup':
            analytics.signups = count;
            break;
          case 'trial_started':
            analytics.trials = count;
            break;
          case 'trial_converted':
            analytics.conversions = count;
            break;
          case 'subscription_canceled':
            analytics.cancellations = count;
            break;
        }
      });

      analytics.conversionRate = analytics.trials > 0 ? (analytics.conversions / analytics.trials) * 100 : 0;

      return analytics;
    } catch (error) {
      logger.error('Error fetching conversion analytics:', error);
      throw error;
    }
  }

  // Reset monthly usage stats
  static async resetMonthlyUsage(): Promise<void> {
    try {
      // Reset usage stats for all users
      await this.db('users').update({
        usage_stats: JSON.stringify({
          watches_used: 0,
          alerts_sent: 0,
          api_calls: 0,
          last_reset: new Date().toISOString()
        })
      });

      logger.info('Monthly usage stats reset completed');
    } catch (error) {
      logger.error('Error resetting monthly usage:', error);
      throw error;
    }
  }
}
