import request from 'supertest';
import app from '../../src/index';
import { User } from '../../src/models/User';
import { SubscriptionService } from '../../src/services/subscriptionService';
import { AuthTestHelpers } from '../helpers/authTestHelpers';

// Mock Stripe
jest.mock('stripe');

// Mock SubscriptionService
jest.mock('../../src/services/subscriptionService');
const MockedSubscriptionService = SubscriptionService as jest.Mocked<typeof SubscriptionService>;

describe('Subscription API Integration Tests', () => {
  let authToken: string;
  let userId: string;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Create test user and get auth token
    const authData = await AuthTestHelpers.createTestUserAndLogin();
    authToken = authData.token;
    userId = authData.user.id;
  });

  afterEach(async () => {
    await AuthTestHelpers.cleanup();
  });

  describe('GET /api/subscription/plans', () => {
    it('should return subscription plans', async () => {
      const mockPlans = [
        {
          id: '1',
          name: 'Free',
          slug: 'free',
          description: 'Basic plan',
          price: 0,
          billing_period: 'monthly' as const,
          stripe_price_id: 'price_free',
          features: ['Basic alerts'],
          limits: { max_watches: 5, max_alerts_per_day: 50, api_rate_limit: 1000 },
          is_active: true,
          trial_days: 0
        },
        {
          id: '2',
          name: 'Pro',
          slug: 'pro',
          description: 'Premium plan',
          price: 9.99,
          billing_period: 'monthly' as const,
          stripe_price_id: 'price_pro',
          features: ['Unlimited watches', 'SMS alerts'],
          limits: { max_watches: null, max_alerts_per_day: null, api_rate_limit: null },
          is_active: true,
          trial_days: 7
        }
      ];

      MockedSubscriptionService.getActivePlans.mockResolvedValue(mockPlans);

      const response = await request(app)
        .get('/api/subscription/plans')
        .expect(200);

      expect(response.body.plans).toEqual(mockPlans);
      expect(MockedSubscriptionService.getActivePlans).toHaveBeenCalled();
    });
  });

  describe('GET /api/subscription/status', () => {
    it('should return user subscription status', async () => {
      const mockStatus = {
        subscription: {
          tier: 'free',
          status: null,
          subscriptionId: null,
          startDate: null,
          endDate: null,
          trialEndDate: null,
          cancelAtPeriodEnd: false,
          stripeCustomerId: null
        },
        usage: {
          watches_used: 2,
          alerts_sent: 10,
          api_calls: 50,
          last_reset: null
        },
        quota: {
          allowed: true,
          limit: 5,
          used: 2
        },
        billingHistory: []
      };

      // Mock User.findById
      jest.spyOn(User, 'findById').mockResolvedValue({
        id: userId,
        subscription_tier: 'free',
        usage_stats: mockStatus.usage
      } as any);

      MockedSubscriptionService.checkQuota.mockResolvedValue(mockStatus.quota);
      MockedSubscriptionService.getBillingHistory.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/subscription/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.subscription.tier).toBe('free');
      expect(response.body.usage).toEqual(mockStatus.usage);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/subscription/status')
        .expect(401);
    });
  });

  describe('POST /api/subscription/checkout', () => {
    it('should create checkout session for valid plan', async () => {
      const mockSession = {
        sessionId: 'cs_test123',
        url: 'https://checkout.stripe.com/pay/cs_test123'
      };

      // Mock User.findById to return free tier user
      jest.spyOn(User, 'findById').mockResolvedValue({
        id: userId,
        subscription_tier: 'free'
      } as any);

      MockedSubscriptionService.recordConversionEvent.mockResolvedValue();
      MockedSubscriptionService.createCheckoutSession.mockResolvedValue(mockSession);

      const response = await request(app)
        .post('/api/subscription/checkout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planSlug: 'pro',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel'
        })
        .expect(200);

      expect(response.body).toEqual(mockSession);
      expect(MockedSubscriptionService.createCheckoutSession).toHaveBeenCalledWith(
        userId,
        'pro',
        'https://example.com/success',
        'https://example.com/cancel'
      );
    });

    it('should reject invalid plan slug', async () => {
      await request(app)
        .post('/api/subscription/checkout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planSlug: 'invalid',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel'
        })
        .expect(400);
    });

    it('should reject if user already has Pro subscription', async () => {
      // Mock User.findById to return Pro user
      jest.spyOn(User, 'findById').mockResolvedValue({
        id: userId,
        subscription_tier: 'pro',
        subscription_status: 'active'
      } as any);

      await request(app)
        .post('/api/subscription/checkout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planSlug: 'pro',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel'
        })
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/subscription/checkout')
        .send({
          planSlug: 'pro',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel'
        })
        .expect(401);
    });
  });

  describe('POST /api/subscription/cancel', () => {
    it('should cancel subscription at period end', async () => {
      MockedSubscriptionService.cancelSubscription.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/subscription/cancel')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cancelAtPeriodEnd: true
        })
        .expect(200);

      expect(response.body.message).toContain('canceled at the end');
      expect(MockedSubscriptionService.cancelSubscription).toHaveBeenCalledWith(userId, true);
    });

    it('should cancel subscription immediately', async () => {
      MockedSubscriptionService.cancelSubscription.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/subscription/cancel')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cancelAtPeriodEnd: false
        })
        .expect(200);

      expect(response.body.message).toContain('canceled immediately');
      expect(MockedSubscriptionService.cancelSubscription).toHaveBeenCalledWith(userId, false);
    });

    it('should handle cancellation failure', async () => {
      MockedSubscriptionService.cancelSubscription.mockResolvedValue(false);

      await request(app)
        .post('/api/subscription/cancel')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cancelAtPeriodEnd: true
        })
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/subscription/cancel')
        .send({
          cancelAtPeriodEnd: true
        })
        .expect(401);
    });
  });

  describe('POST /api/subscription/reactivate', () => {
    it('should reactivate subscription', async () => {
      MockedSubscriptionService.reactivateSubscription.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/subscription/reactivate')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toContain('reactivated successfully');
      expect(MockedSubscriptionService.reactivateSubscription).toHaveBeenCalledWith(userId);
    });

    it('should handle reactivation failure', async () => {
      MockedSubscriptionService.reactivateSubscription.mockResolvedValue(false);

      await request(app)
        .post('/api/subscription/reactivate')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/subscription/reactivate')
        .expect(401);
    });
  });

  describe('GET /api/subscription/usage', () => {
    it('should return usage statistics', async () => {
      const mockUsage = {
        watches_used: 3,
        alerts_sent: 15,
        api_calls: 100,
        last_reset: null
      };

      const mockQuotas = {
        watches: { allowed: true, limit: 5, used: 3 },
        alerts: { allowed: true, limit: 50, used: 15 },
        apiCalls: { allowed: true, limit: 1000, used: 100 }
      };

      // Mock User.findById
      jest.spyOn(User, 'findById').mockResolvedValue({
        id: userId,
        subscription_tier: 'free',
        usage_stats: mockUsage
      } as any);

      MockedSubscriptionService.checkQuota
        .mockResolvedValueOnce(mockQuotas.watches)
        .mockResolvedValueOnce(mockQuotas.alerts)
        .mockResolvedValueOnce(mockQuotas.apiCalls);

      const response = await request(app)
        .get('/api/subscription/usage')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.usage).toEqual(mockUsage);
      expect(response.body.quotas).toEqual(mockQuotas);
      expect(response.body.subscriptionTier).toBe('free');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/subscription/usage')
        .expect(401);
    });
  });

  describe('GET /api/subscription/billing-history', () => {
    it('should return billing history', async () => {
      const mockHistory = [
        {
          id: '1',
          user_id: userId,
          event_type: 'subscription_created',
          event_data: { subscription_id: 'sub_123' },
          amount: 9.99,
          currency: 'USD',
          event_date: new Date()
        }
      ];

      MockedSubscriptionService.getBillingHistory.mockResolvedValue(mockHistory);

      const response = await request(app)
        .get('/api/subscription/billing-history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.billingHistory).toEqual(mockHistory);
      expect(MockedSubscriptionService.getBillingHistory).toHaveBeenCalledWith(userId, 10);
    });

    it('should support custom limit', async () => {
      MockedSubscriptionService.getBillingHistory.mockResolvedValue([]);

      await request(app)
        .get('/api/subscription/billing-history?limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(MockedSubscriptionService.getBillingHistory).toHaveBeenCalledWith(userId, 5);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/subscription/billing-history')
        .expect(401);
    });
  });
});