import Stripe from 'stripe';
import { User } from '../models/User';
import { BaseModel } from '../models/BaseModel';
import { IUser, IUsageStats } from '../types/database';
import { SubscriptionTier } from '../types/subscription';
import { logger } from '../utils/logger';

// Initialize Stripe using environment configuration
const stripeSecret = process.env.STRIPE_SECRET_KEY || '';
if (!stripeSecret) {
  // In development without Stripe configured, we still allow the app to boot
  // but methods that require Stripe will throw a clear error.
}
const stripe = stripeSecret
  ? new Stripe(stripeSecret as string)
  : (null as any);

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
      
      return plans.map(plan => ({
        ...plan,
        features: typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features,
        limits: typeof plan.limits === 'string' ? JSON.parse(plan.limits) : plan.limits
      }));
    } catch (error) {
      logger.error('Error fetching subscription plans:', error);
      throw new Error('Failed to fetch subscription plans');
    }
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

      const plan = await this.getPlanBySlug(planSlug);
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

      // Add primary subscription line item
      sessionData.line_items!.push({ price: plan.stripe_price_id, quantity: 1 });

      // Optionally add a one-time setup fee if configured
      const setupFeePriceId = process.env.STRIPE_SETUP_FEE_PRICE_ID;
      if (setupFeePriceId) {
        sessionData.line_items!.push({ price: setupFeePriceId, quantity: 1 });
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

      // Update user subscription status
      const updateData: Partial<IUser> = {
        subscription_id: subscription.id,
        subscription_status: subscription.status as any,
        subscription_tier: SubscriptionTier.PRO
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

      // Free tier limits
      if (user.subscription_tier === SubscriptionTier.FREE) {
        const limits = {
          watch_created: 5,
          alert_sent: 50,
          api_call: 1000
        };

        const limit = limits[usageType as keyof typeof limits];
        if (limit && user.usage_stats) {
          let used = 0;
          switch (usageType) {
            case 'watch_created':
              used = user.usage_stats.watches_used || 0;
              break;
            case 'alert_sent':
              used = user.usage_stats.alerts_sent || 0;
              break;
            case 'api_call':
              used = user.usage_stats.api_calls || 0;
              break;
          }
          
          return {
            allowed: used < limit,
            limit,
            used
          };
        }
      }

      // Pro tier has no limits
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
