import { apiClient } from './apiClient';

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

export interface SubscriptionStatus {
  tier: 'free' | 'pro';
  status?: string;
  subscriptionId?: string;
  planId?: string;
  startDate?: string;
  endDate?: string;
  trialEndDate?: string;
  cancelAtPeriodEnd?: boolean;
  stripeCustomerId?: string;
}

export interface UsageStats {
  watches_used: number;
  alerts_sent: number;
  api_calls: number;
  last_reset: string | null;
}

export interface QuotaInfo {
  allowed: boolean;
  limit?: number;
  used?: number;
}

export interface BillingEvent {
  id: string;
  user_id: string;
  event_type: string;
  stripe_event_id?: string;
  event_data: Record<string, unknown>;
  amount?: number;
  currency: string;
  event_date: string;
}

export interface CheckoutSession {
  sessionId: string;
  url: string;
}

class SubscriptionService {
  // Get all available subscription plans
  async getPlans(): Promise<SubscriptionPlan[]> {
    const response = await apiClient.get('/subscription/plans');
    return response.data.plans;
  }

  // Get current user's subscription status
  async getSubscriptionStatus(): Promise<{
    subscription: SubscriptionStatus;
    usage: UsageStats;
    quota: QuotaInfo;
    billingHistory: BillingEvent[];
  }> {
    const response = await apiClient.get('/subscription/status');
    return response.data;
  }

  // Get usage statistics
  async getUsageStats(): Promise<{
    usage: UsageStats;
    quotas: {
      watches: QuotaInfo;
      alerts: QuotaInfo;
      apiCalls: QuotaInfo;
    };
    subscriptionTier: string;
  }> {
    const response = await apiClient.get('/subscription/usage');
    return response.data;
  }

  // Create checkout session for subscription upgrade
  async createCheckoutSession(
    planSlug: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<CheckoutSession> {
    const response = await apiClient.post('/subscription/checkout', {
      planSlug,
      successUrl,
      cancelUrl
    });
    return response.data;
  }

  // Cancel subscription
  async cancelSubscription(cancelAtPeriodEnd: boolean = true): Promise<{ message: string; cancelAtPeriodEnd: boolean }> {
    const response = await apiClient.post('/subscription/cancel', {
      cancelAtPeriodEnd
    });
    return response.data;
  }

  // Reactivate subscription
  async reactivateSubscription(): Promise<{ message: string }> {
    const response = await apiClient.post('/subscription/reactivate');
    return response.data;
  }

  // Get billing history
  async getBillingHistory(limit: number = 10): Promise<BillingEvent[]> {
    const response = await apiClient.get(`/subscription/billing-history?limit=${limit}`);
    return response.data.billingHistory;
  }

  // Redirect to Stripe checkout
  async redirectToCheckout(planSlug: string): Promise<void> {
    const baseUrl = window.location.origin;
    const successUrl = `${baseUrl}/subscription/success`;
    const cancelUrl = `${baseUrl}/pricing`;

    const session = await this.createCheckoutSession(planSlug, successUrl, cancelUrl);
    
    // Redirect to Stripe Checkout
    window.location.href = session.url;
  }

  // Check if user can perform action based on quota
  async checkQuota(action: 'watch' | 'alert' | 'api'): Promise<QuotaInfo> {
    const stats = await this.getUsageStats();
    
    switch (action) {
      case 'watch':
        return stats.quotas.watches;
      case 'alert':
        return stats.quotas.alerts;
      case 'api':
        return stats.quotas.apiCalls;
      default:
        return { allowed: false };
    }
  }

  // Format price for display
  formatPrice(price: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(price);
  }

  // Calculate savings for annual plans
  calculateAnnualSavings(monthlyPrice: number, annualPrice: number): {
    savings: number;
    percentage: number;
  } {
    const annualEquivalent = monthlyPrice * 12;
    const savings = annualEquivalent - annualPrice;
    const percentage = Math.round((savings / annualEquivalent) * 100);
    
    return { savings, percentage };
  }

  // Get plan features comparison
  getPlanComparison(): {
    free: string[];
    pro: string[];
  } {
    return {
      free: [
        'Up to 5 product watches',
        'Basic email alerts',
        'Web push notifications',
        'Community support'
      ],
      pro: [
        'Unlimited product watches',
        'SMS & Discord alerts',
        'Priority alert delivery',
        'Price predictions & ROI',
        'Historical data access',
        'Premium support'
      ]
    };
  }

  // Check if feature is available for current tier
  isFeatureAvailable(feature: string, tier: 'free' | 'pro'): boolean {
    const proFeatures = [
      'unlimited_watches',
      'sms_alerts',
      'discord_alerts',
      'priority_delivery',
      'price_predictions',
      'historical_data',
      'premium_support'
    ];

    if (tier === 'pro') {
      return true;
    }

    return !proFeatures.includes(feature);
  }
}

export const subscriptionService = new SubscriptionService();
