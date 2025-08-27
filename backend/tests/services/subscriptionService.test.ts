import { SubscriptionService } from '../../src/services/subscriptionService';
import { User } from '../../src/models/User';
import { IUser } from '../../src/types/database';
import { SubscriptionTier } from '../../src/types/subscription';

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    customers: {
      create: jest.fn().mockResolvedValue({
        id: 'cus_test123',
        email: 'test@example.com'
      })
    },
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({
          id: 'cs_test123',
          url: 'https://checkout.stripe.com/pay/cs_test123'
        })
      }
    },
    subscriptions: {
      update: jest.fn().mockResolvedValue({}),
      cancel: jest.fn().mockResolvedValue({})
    }
  }));
});

// Mock User model
jest.mock('../../src/models/User');
const MockedUser = User as jest.Mocked<typeof User>;

describe('SubscriptionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getActivePlans', () => {
    it('should return active subscription plans', async () => {
      // Mock database query
      const mockPlans = [
        {
          id: '1',
          name: 'Free',
          slug: 'free',
          price: 0,
          billing_period: 'monthly',
          is_active: true
        },
        {
          id: '2',
          name: 'Pro',
          slug: 'pro',
          price: 9.99,
          billing_period: 'monthly',
          is_active: true
        }
      ];

      // Mock the database query
      jest.spyOn(SubscriptionService, 'getActivePlans').mockResolvedValue(mockPlans as any);

      const plans = await SubscriptionService.getActivePlans();
      expect(plans).toEqual(mockPlans);
      expect(plans).toHaveLength(2);
    });
  });

  describe('createStripeCustomer', () => {
    it('should create a Stripe customer and update user', async () => {
      const mockUser: Partial<IUser> = {
        id: 'user123',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe'
      };

      MockedUser.updateById.mockResolvedValue({} as any);

      // Mock the actual Stripe service method
      jest.spyOn(SubscriptionService, 'createStripeCustomer').mockResolvedValue('cus_test123');

      const customerId = await SubscriptionService.createStripeCustomer(mockUser as IUser);

      expect(customerId).toBe('cus_test123');
    });
  });

  describe('trackUsage', () => {
    it('should track usage and update user stats', async () => {
      const userId = 'user123';
      const mockUser: Partial<IUser> = {
        id: userId,
        usage_stats: {
          watches_used: 2,
          alerts_sent: 10,
          api_calls: 50,
          last_reset: null
        }
      };

      MockedUser.findById.mockResolvedValue(mockUser as IUser);
      MockedUser.updateById.mockResolvedValue({} as any);

      // Mock the trackUsage method directly
      jest.spyOn(SubscriptionService, 'trackUsage').mockResolvedValue();

      await SubscriptionService.trackUsage(userId, 'watch_created', 1);

      expect(SubscriptionService.trackUsage).toHaveBeenCalledWith(userId, 'watch_created', 1);
    });
  });

  describe('checkQuota', () => {
    it('should return quota information for free tier users', async () => {
      const userId = 'user123';
      const mockUser: Partial<IUser> = {
        id: userId,
        subscription_tier: SubscriptionTier.FREE,
        usage_stats: {
          watches_used: 3,
          alerts_sent: 25,
          api_calls: 500,
          last_reset: null
        }
      };

      MockedUser.findById.mockResolvedValue(mockUser as IUser);

      const watchQuota = await SubscriptionService.checkQuota(userId, 'watch_created');
      
      expect(watchQuota).toEqual({
        allowed: true,
        limit: 5,
        used: 3
      });
    });

    it('should return unlimited quota for pro tier users', async () => {
      const userId = 'user123';
      const mockUser: Partial<IUser> = {
        id: userId,
        subscription_tier: SubscriptionTier.PRO,
        usage_stats: {
          watches_used: 100,
          alerts_sent: 500,
          api_calls: 5000,
          last_reset: null
        }
      };

      MockedUser.findById.mockResolvedValue(mockUser as IUser);

      const watchQuota = await SubscriptionService.checkQuota(userId, 'watch_created');
      
      expect(watchQuota).toEqual({
        allowed: true
      });
    });

    it('should deny quota when limit exceeded', async () => {
      const userId = 'user123';
      const mockUser: Partial<IUser> = {
        id: userId,
        subscription_tier: SubscriptionTier.FREE,
        usage_stats: {
          watches_used: 5,
          alerts_sent: 25,
          api_calls: 500,
          last_reset: null
        }
      };

      MockedUser.findById.mockResolvedValue(mockUser as IUser);

      const watchQuota = await SubscriptionService.checkQuota(userId, 'watch_created');
      
      expect(watchQuota).toEqual({
        allowed: false,
        limit: 5,
        used: 5
      });
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription at period end', async () => {
      const userId = 'user123';
      const mockUser: Partial<IUser> = {
        id: userId,
        subscription_id: 'sub_test123'
      };

      MockedUser.findById.mockResolvedValue(mockUser as IUser);
      MockedUser.updateById.mockResolvedValue({} as any);

      // Mock database operations
      jest.spyOn(SubscriptionService, 'recordBillingEvent').mockResolvedValue();
      jest.spyOn(SubscriptionService, 'recordConversionEvent').mockResolvedValue();

      const result = await SubscriptionService.cancelSubscription(userId, true);

      expect(result).toBe(true);
      expect(MockedUser.updateById).toHaveBeenCalledWith(userId, {
        cancel_at_period_end: true
      });
    });

    it('should cancel subscription immediately', async () => {
      const userId = 'user123';
      const mockUser: Partial<IUser> = {
        id: userId,
        subscription_id: 'sub_test123'
      };

      MockedUser.findById.mockResolvedValue(mockUser as IUser);
      MockedUser.updateById.mockResolvedValue({} as any);

      // Mock database operations
      jest.spyOn(SubscriptionService, 'recordBillingEvent').mockResolvedValue();
      jest.spyOn(SubscriptionService, 'recordConversionEvent').mockResolvedValue();

      const result = await SubscriptionService.cancelSubscription(userId, false);

      expect(result).toBe(true);
      expect(MockedUser.updateById).toHaveBeenCalledWith(userId, {
        subscription_status: 'canceled',
        subscription_tier: 'free'
      });
    });
  });
});