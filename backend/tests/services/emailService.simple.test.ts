import { EmailService } from '../../src/services/notifications/emailService';
import { EmailPreferencesService } from '../../src/services/emailPreferencesService';
import { EmailDeliveryService } from '../../src/services/emailDeliveryService';
import { IAlert, IUser } from '../../src/types/database';
import { SubscriptionTier } from '../../src/types/subscription';

// Mock the dependencies
jest.mock('../../src/services/emailPreferencesService');
jest.mock('../../src/services/emailDeliveryService');

const mockEmailPreferencesService = EmailPreferencesService as jest.Mocked<typeof EmailPreferencesService>;
const mockEmailDeliveryService = EmailDeliveryService as jest.Mocked<typeof EmailDeliveryService>;

describe('EmailService - Core Logic', () => {
  const mockUser: IUser = {
    id: 'user-123',
    email: 'test@example.com',
    email_verified: true,
    first_name: 'Test',
    last_name: 'User',
    password_hash: 'hash',
    subscription_tier: SubscriptionTier.FREE,
    role: 'user',
    admin_permissions: [],
    failed_login_attempts: 0,
    shipping_addresses: [],
    payment_methods: [],
    retailer_credentials: {},
    notification_settings: {
      web_push: true,
      email: true,
      sms: false,
      discord: false
    },
    quiet_hours: {
      enabled: false,
      start_time: '22:00',
      end_time: '08:00',
      timezone: 'UTC',
      days: []
    },
    timezone: 'UTC',
    preferences: {},
    created_at: new Date(),
    updated_at: new Date()
  };

  const mockAlert: IAlert = {
    id: 'alert-123',
    user_id: 'user-123',
    product_id: 'product-123',
    retailer_id: 'retailer-123',
    type: 'restock',
    priority: 'high',
    data: {
      product_name: 'Pokémon Booster Box',
      retailer_name: 'Best Buy',
      price: 89.99,
      original_price: 99.99,
      availability_status: 'in_stock',
      product_url: 'https://bestbuy.com/product/123',
      cart_url: 'https://bestbuy.com/cart/add/123'
    },
    status: 'pending',
    delivery_channels: ['email'],
    retry_count: 0,
    created_at: new Date(),
    updated_at: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockEmailPreferencesService.canReceiveEmail.mockResolvedValue(true);
    mockEmailPreferencesService.createUnsubscribeToken.mockResolvedValue('unsubscribe-token-123');
    mockEmailDeliveryService.logEmailSent.mockResolvedValue('log-123');
  });

  describe('sendAlert - Validation Logic', () => {
    it('should fail if user email is not verified', async () => {
      const unverifiedUser = { ...mockUser, email_verified: false };

      const result = await EmailService.sendAlert(mockAlert, unverifiedUser);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User email not verified');
    });

    it('should fail if user has disabled alert emails', async () => {
      mockEmailPreferencesService.canReceiveEmail.mockResolvedValue(false);

      const result = await EmailService.sendAlert(mockAlert, mockUser);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User has disabled alert emails');
    });

    it('should check email preferences correctly', async () => {
      mockEmailPreferencesService.canReceiveEmail.mockResolvedValue(true);

      await EmailService.sendAlert(mockAlert, mockUser);

      expect(mockEmailPreferencesService.canReceiveEmail).toHaveBeenCalledWith('user-123', 'alerts');
    });
  });

  describe('sendWelcomeEmail - Validation Logic', () => {
    it('should fail if user has disabled marketing emails', async () => {
      mockEmailPreferencesService.canReceiveEmail.mockResolvedValue(false);

      const result = await EmailService.sendWelcomeEmail(mockUser);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User has disabled marketing emails');
    });

    it('should check marketing email preferences correctly', async () => {
      mockEmailPreferencesService.canReceiveEmail.mockResolvedValue(true);

      await EmailService.sendWelcomeEmail(mockUser);

      expect(mockEmailPreferencesService.canReceiveEmail).toHaveBeenCalledWith('user-123', 'marketing');
    });
  });

  describe('handleEmailWebhook', () => {
    it('should handle bounce webhook', async () => {
      const webhookData = {
        eventType: 'bounce' as const,
        messageId: 'msg-123',
        bounceType: 'permanent' as const,
        bounceSubType: 'general',
        bouncedRecipients: [{
          emailAddress: 'test@example.com',
          status: 'failed',
          action: 'failed'
        }],
        timestamp: '2023-01-01T00:00:00Z'
      };

      await EmailService.handleEmailWebhook(webhookData);

      expect(mockEmailDeliveryService.handleBounce).toHaveBeenCalled();
    });

    it('should handle complaint webhook', async () => {
      const webhookData = {
        eventType: 'complaint' as const,
        messageId: 'msg-123',
        complainedRecipients: [{
          emailAddress: 'test@example.com'
        }],
        timestamp: '2023-01-01T00:00:00Z'
      };

      await EmailService.handleEmailWebhook(webhookData);

      expect(mockEmailDeliveryService.handleComplaint).toHaveBeenCalled();
    });

    it('should handle delivery webhook', async () => {
      const webhookData = {
        eventType: 'delivery' as const,
        messageId: 'msg-123',
        timestamp: '2023-01-01T00:00:00Z'
      };

      await EmailService.handleEmailWebhook(webhookData);

      expect(mockEmailDeliveryService.updateDeliveryStatus).toHaveBeenCalledWith(
        'msg-123',
        'delivered',
        { timestamp: new Date('2023-01-01T00:00:00Z') }
      );
    });
  });

  describe('getEmailStats', () => {
    it('should return email delivery statistics', async () => {
      const mockStats = {
        totalSent: 100,
        totalDelivered: 95,
        totalBounced: 3,
        totalComplained: 2,
        deliveryRate: 95,
        bounceRate: 3,
        complaintRate: 2
      };

      mockEmailPreferencesService.getDeliveryStats.mockResolvedValue(mockStats);

      const result = await EmailService.getEmailStats();

      expect(result).toEqual({
        emailsSent: 100,
        emailsDelivered: 95,
        emailsBounced: 3,
        emailsComplained: 2,
        deliveryRate: 95,
        bounceRate: 3,
        complaintRate: 2
      });
    });
  });
});
