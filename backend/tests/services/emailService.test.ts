import { EmailService } from '../../src/services/notifications/emailService';
import { EmailPreferencesService } from '../../src/services/emailPreferencesService';
import { EmailDeliveryService } from '../../src/services/emailDeliveryService';
import { IAlert, IUser } from '../../src/types/database';
import { SubscriptionTier } from '../../src/types/subscription';

// Mock the dependencies
jest.mock('../../src/services/emailPreferencesService');
jest.mock('../../src/services/emailDeliveryService');

// Mock nodemailer
const mockSendMail = jest.fn();
const mockVerify = jest.fn();
const mockTransporter = {
  sendMail: mockSendMail,
  verify: mockVerify
};

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => mockTransporter)
}));

const mockEmailPreferencesService = EmailPreferencesService as jest.Mocked<typeof EmailPreferencesService>;
const mockEmailDeliveryService = EmailDeliveryService as jest.Mocked<typeof EmailDeliveryService>;

describe('EmailService', () => {
  const mockUser: IUser = {
    id: 'user-123',
    email: 'test@example.com',
    email_verified: true,
    first_name: 'Test',
    last_name: 'User',
    password_hash: 'hash',
    subscription_tier: SubscriptionTier.FREE,
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
    
    // Setup nodemailer mocks
    mockSendMail.mockResolvedValue({
      messageId: 'msg-123',
      response: 'OK'
    });
    mockVerify.mockResolvedValue(true);
  });

  describe('sendAlert', () => {
    it('should send alert email successfully', async () => {
      const result = await EmailService.sendAlert(mockAlert, mockUser);

      expect(result.success).toBe(true);
      expect(result.channel).toBe('email');
      expect(result.externalId).toBe('msg-123');
      expect(mockEmailPreferencesService.canReceiveEmail).toHaveBeenCalledWith('user-123', 'alerts');
      expect(mockEmailDeliveryService.logEmailSent).toHaveBeenCalled();
      expect(mockSendMail).toHaveBeenCalled();
    });

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

    it('should generate correct email template for restock alert', async () => {
      await EmailService.sendAlert(mockAlert, mockUser);

      const sendMailCall = mockSendMail.mock.calls[0][0];
      expect(sendMailCall.subject).toContain('back in stock');
      expect(sendMailCall.html).toContain('Product Back in Stock!');
      expect(sendMailCall.html).toContain('Pokémon Booster Box');
      expect(sendMailCall.html).toContain('Best Buy');
    });

    it('should generate correct email template for price drop alert', async () => {
      const priceDropAlert = { ...mockAlert, type: 'price_drop' as const };
      
      await EmailService.sendAlert(priceDropAlert, mockUser);

      const sendMailCall = mockSendMail.mock.calls[0][0];
      expect(sendMailCall.subject).toContain('Price drop alert');
      expect(sendMailCall.html).toContain('Price Drop Alert!');
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email successfully', async () => {
      mockEmailPreferencesService.canReceiveEmail.mockResolvedValue(true);

      const result = await EmailService.sendWelcomeEmail(mockUser);

      expect(result.success).toBe(true);
      expect(mockEmailPreferencesService.canReceiveEmail).toHaveBeenCalledWith('user-123', 'marketing');
      expect(mockEmailDeliveryService.logEmailSent).toHaveBeenCalled();
    });

    it('should fail if user has disabled marketing emails', async () => {
      mockEmailPreferencesService.canReceiveEmail.mockResolvedValue(false);

      const result = await EmailService.sendWelcomeEmail(mockUser);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User has disabled marketing emails');
    });

    it('should generate correct welcome email template', async () => {
      mockEmailPreferencesService.canReceiveEmail.mockResolvedValue(true);

      await EmailService.sendWelcomeEmail(mockUser);

      const sendMailCall = mockSendMail.mock.calls[0][0];
      expect(sendMailCall.subject).toContain('Welcome to BoosterBeacon');
      expect(sendMailCall.html).toContain('Hi Test!');
      expect(sendMailCall.html).toContain('Welcome to BoosterBeacon');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email successfully', async () => {
      const resetToken = 'reset-token-123';

      const result = await EmailService.sendPasswordResetEmail(mockUser, resetToken);

      expect(result.success).toBe(true);
      expect(mockEmailDeliveryService.logEmailSent).toHaveBeenCalled();
    });

    it('should generate correct password reset email template', async () => {
      const resetToken = 'reset-token-123';

      await EmailService.sendPasswordResetEmail(mockUser, resetToken);

      const sendMailCall = mockSendMail.mock.calls[0][0];
      expect(sendMailCall.subject).toContain('Reset your BoosterBeacon password');
      expect(sendMailCall.html).toContain('Password Reset');
      expect(sendMailCall.html).toContain(resetToken);
    });
  });

  describe('testEmailConfiguration', () => {
    it('should return success when email configuration is valid', async () => {
      const result = await EmailService.testEmailConfiguration();

      expect(result.success).toBe(true);
      expect(mockVerify).toHaveBeenCalled();
    });

    it('should return error when email configuration is invalid', async () => {
      mockVerify.mockRejectedValue(new Error('SMTP connection failed'));

      const result = await EmailService.testEmailConfiguration();

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMTP connection failed');
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