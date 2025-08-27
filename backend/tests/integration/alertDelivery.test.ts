import { AlertDeliveryService } from '../../src/services/alertDeliveryService';
import { WebPushService } from '../../src/services/notifications/webPushService';
import { EmailService } from '../../src/services/notifications/emailService';
import { SMSService } from '../../src/services/notifications/smsService';
import { DiscordService } from '../../src/services/notifications/discordService';
import { IAlert, IUser } from '../../src/types/database';
import { SubscriptionTier } from '../../src/types/subscription';

// Mock notification services
jest.mock('../../src/services/notifications/webPushService');
jest.mock('../../src/services/notifications/emailService');
jest.mock('../../src/services/notifications/smsService');
jest.mock('../../src/services/notifications/discordService');

const MockedWebPushService = WebPushService as jest.Mocked<typeof WebPushService>;
const MockedEmailService = EmailService as jest.Mocked<typeof EmailService>;
const MockedSMSService = SMSService as jest.Mocked<typeof SMSService>;
const MockedDiscordService = DiscordService as jest.Mocked<typeof DiscordService>;

describe('AlertDeliveryService Integration Tests', () => {
  const mockUser: IUser = {
    id: 'user-1',
    email: 'test@example.com',
    password_hash: 'hashed',
    subscription_tier: SubscriptionTier.PRO,
    email_verified: true,
    failed_login_attempts: 0,
    shipping_addresses: [],
    payment_methods: [],
    retailer_credentials: {},
    notification_settings: {
      web_push: true,
      email: true,
      sms: true,
      discord: true,
      discord_webhook: 'https://discord.com/api/webhooks/123/abc'
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
    id: 'alert-1',
    user_id: 'user-1',
    product_id: 'product-1',
    retailer_id: 'retailer-1',
    type: 'restock',
    priority: 'high',
    data: {
      product_name: 'Pokémon Booster Box',
      retailer_name: 'Best Buy',
      availability_status: 'in_stock',
      product_url: 'https://bestbuy.com/product/123',
      cart_url: 'https://bestbuy.com/cart/add/123',
      price: 89.99,
      original_price: 99.99
    },
    status: 'pending',
    delivery_channels: [],
    retry_count: 0,
    created_at: new Date(),
    updated_at: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('deliverAlert', () => {
    it('should deliver alert to all channels successfully', async () => {
      // Mock successful delivery for all channels
      MockedWebPushService.sendNotification.mockResolvedValue({
        channel: 'web_push',
        success: true,
        externalId: 'push-123',
        metadata: { subscriptionsSent: 1 }
      });

      MockedEmailService.sendAlert.mockResolvedValue({
        channel: 'email',
        success: true,
        externalId: 'email-123',
        metadata: { messageId: 'email-123' }
      });

      MockedSMSService.sendAlert.mockResolvedValue({
        channel: 'sms',
        success: true,
        externalId: 'sms-123',
        metadata: { messageLength: 120 }
      });

      MockedDiscordService.sendAlert.mockResolvedValue({
        channel: 'discord',
        success: true,
        externalId: 'discord-123',
        metadata: { embedCount: 1 }
      });

      const channels = ['web_push', 'email', 'sms', 'discord'];
      const result = await AlertDeliveryService.deliverAlert(mockAlert, mockUser, channels);

      expect(result.success).toBe(true);
      expect(result.successfulChannels).toEqual(channels);
      expect(result.failedChannels).toEqual([]);
      expect(result.deliveryIds).toHaveLength(4);

      // Verify each service was called
      expect(MockedWebPushService.sendNotification).toHaveBeenCalledWith(mockAlert, mockUser);
      expect(MockedEmailService.sendAlert).toHaveBeenCalledWith(mockAlert, mockUser);
      expect(MockedSMSService.sendAlert).toHaveBeenCalledWith(mockAlert, mockUser);
      expect(MockedDiscordService.sendAlert).toHaveBeenCalledWith(mockAlert, mockUser);
    });

    it('should handle partial delivery failures gracefully', async () => {
      MockedWebPushService.sendNotification.mockResolvedValue({
        channel: 'web_push',
        success: true,
        externalId: 'push-123'
      });

      MockedEmailService.sendAlert.mockResolvedValue({
        channel: 'email',
        success: false,
        error: 'SMTP server unavailable'
      });

      MockedSMSService.sendAlert.mockResolvedValue({
        channel: 'sms',
        success: true,
        externalId: 'sms-123'
      });

      const channels = ['web_push', 'email', 'sms'];
      const result = await AlertDeliveryService.deliverAlert(mockAlert, mockUser, channels);

      expect(result.success).toBe(true); // Should be true if at least one channel succeeds
      expect(result.successfulChannels).toEqual(['web_push', 'sms']);
      expect(result.failedChannels).toEqual(['email']);
      expect(result.error).toContain('email: SMTP server unavailable');
    });

    it('should handle complete delivery failure', async () => {
      MockedWebPushService.sendNotification.mockResolvedValue({
        channel: 'web_push',
        success: false,
        error: 'No push subscriptions'
      });

      MockedEmailService.sendAlert.mockResolvedValue({
        channel: 'email',
        success: false,
        error: 'Email not verified'
      });

      const channels = ['web_push', 'email'];
      const result = await AlertDeliveryService.deliverAlert(mockAlert, mockUser, channels);

      expect(result.success).toBe(false);
      expect(result.successfulChannels).toEqual([]);
      expect(result.failedChannels).toEqual(['web_push', 'email']);
      expect(result.error).toContain('web_push: No push subscriptions');
      expect(result.error).toContain('email: Email not verified');
    });

    it('should handle delivery timeouts', async () => {
      // Mock a service that takes too long
      MockedWebPushService.sendNotification.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 35000)) // 35 seconds, longer than timeout
      );

      MockedEmailService.sendAlert.mockResolvedValue({
        channel: 'email',
        success: true,
        externalId: 'email-123'
      });

      const channels = ['web_push', 'email'];
      const result = await AlertDeliveryService.deliverAlert(mockAlert, mockUser, channels);

      expect(result.success).toBe(true); // Email should succeed
      expect(result.successfulChannels).toEqual(['email']);
      expect(result.failedChannels).toEqual(['web_push']);
    });

    it('should handle service exceptions', async () => {
      MockedWebPushService.sendNotification.mockRejectedValue(new Error('Service crashed'));

      MockedEmailService.sendAlert.mockResolvedValue({
        channel: 'email',
        success: true,
        externalId: 'email-123'
      });

      const channels = ['web_push', 'email'];
      const result = await AlertDeliveryService.deliverAlert(mockAlert, mockUser, channels);

      expect(result.success).toBe(true);
      expect(result.successfulChannels).toEqual(['email']);
      expect(result.failedChannels).toEqual(['web_push']);
    });
  });

  describe('bulkDeliverAlerts', () => {
    it('should deliver multiple alerts in batches', async () => {
      const alerts = Array.from({ length: 15 }, (_, i) => ({
        alert: { ...mockAlert, id: `alert-${i}` },
        user: mockUser,
        channels: ['web_push', 'email']
      }));

      MockedWebPushService.sendNotification.mockResolvedValue({
        channel: 'web_push',
        success: true,
        externalId: 'push-123'
      });

      MockedEmailService.sendAlert.mockResolvedValue({
        channel: 'email',
        success: true,
        externalId: 'email-123'
      });

      const results = await AlertDeliveryService.bulkDeliverAlerts(alerts);

      expect(results).toHaveLength(15);
      expect(results.every(r => r.success)).toBe(true);
      
      // Should have called services for each alert
      expect(MockedWebPushService.sendNotification).toHaveBeenCalledTimes(15);
      expect(MockedEmailService.sendAlert).toHaveBeenCalledTimes(15);
    });

    it('should handle mixed success/failure in bulk delivery', async () => {
      const alerts = Array.from({ length: 3 }, (_, i) => ({
        alert: { ...mockAlert, id: `alert-${i}` },
        user: mockUser,
        channels: ['web_push']
      }));

      // First alert succeeds, second fails, third succeeds
      MockedWebPushService.sendNotification
        .mockResolvedValueOnce({
          channel: 'web_push',
          success: true,
          externalId: 'push-1'
        })
        .mockResolvedValueOnce({
          channel: 'web_push',
          success: false,
          error: 'Push failed'
        })
        .mockResolvedValueOnce({
          channel: 'web_push',
          success: true,
          externalId: 'push-3'
        });

      const results = await AlertDeliveryService.bulkDeliverAlerts(alerts);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });
  });

  describe('validateChannelConfig', () => {
    it('should validate web push channel (always valid)', async () => {
      const result = await AlertDeliveryService.validateChannelConfig('web_push', mockUser);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate email channel', async () => {
      const userWithUnverifiedEmail = {
        ...mockUser,
        email_verified: false
      };

      const result = await AlertDeliveryService.validateChannelConfig('email', userWithUnverifiedEmail);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email not verified');
    });

    it('should validate SMS channel for free user', async () => {
      const freeUser = {
        ...mockUser,
        subscription_tier: SubscriptionTier.FREE
      };

      const result = await AlertDeliveryService.validateChannelConfig('sms', freeUser);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('SMS requires Pro subscription');
    });

    it('should validate Discord channel without webhook', async () => {
      const userWithoutWebhook = {
        ...mockUser,
        notification_settings: {
          ...mockUser.notification_settings,
          discord_webhook: undefined
        }
      };

      const result = await AlertDeliveryService.validateChannelConfig('discord', userWithoutWebhook);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Discord webhook not configured');
    });

    it('should reject unsupported channel', async () => {
      const result = await AlertDeliveryService.validateChannelConfig('telegram', mockUser);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unsupported channel: telegram');
    });
  });

  describe('error handling and resilience', () => {
    it('should handle network errors gracefully', async () => {
      MockedWebPushService.sendNotification.mockRejectedValue(
        new Error('Network timeout')
      );

      const result = await AlertDeliveryService.deliverAlert(
        mockAlert, 
        mockUser, 
        ['web_push']
      );

      expect(result.success).toBe(false);
      expect(result.failedChannels).toEqual(['web_push']);
    });

    it('should handle service unavailable errors', async () => {
      MockedEmailService.sendAlert.mockResolvedValue({
        channel: 'email',
        success: false,
        error: 'Service temporarily unavailable'
      });

      const result = await AlertDeliveryService.deliverAlert(
        mockAlert, 
        mockUser, 
        ['email']
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Service temporarily unavailable');
    });

    it('should handle malformed responses from services', async () => {
      // Mock service returning invalid response
      MockedWebPushService.sendNotification.mockResolvedValue({
        channel: 'web_push',
        success: true
        // Missing required fields
      } as any);

      const result = await AlertDeliveryService.deliverAlert(
        mockAlert, 
        mockUser, 
        ['web_push']
      );

      expect(result.success).toBe(true); // Should still work with partial data
      expect(result.successfulChannels).toContain('web_push');
    });
  });

  describe('performance and concurrency', () => {
    it('should handle concurrent deliveries efficiently', async () => {
      const startTime = Date.now();
      
      // Mock services with realistic delays
      MockedWebPushService.sendNotification.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          channel: 'web_push',
          success: true,
          externalId: 'push-123'
        }), 100))
      );

      MockedEmailService.sendAlert.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          channel: 'email',
          success: true,
          externalId: 'email-123'
        }), 150))
      );

      MockedSMSService.sendAlert.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          channel: 'sms',
          success: true,
          externalId: 'sms-123'
        }), 200))
      );

      const result = await AlertDeliveryService.deliverAlert(
        mockAlert, 
        mockUser, 
        ['web_push', 'email', 'sms']
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(result.successfulChannels).toHaveLength(3);
      
      // Should complete in roughly the time of the slowest service (200ms)
      // plus some overhead, not the sum of all services (450ms)
      expect(duration).toBeLessThan(400);
    });

    it('should respect batch size limits in bulk delivery', async () => {
      const largeAlertBatch = Array.from({ length: 25 }, (_, i) => ({
        alert: { ...mockAlert, id: `alert-${i}` },
        user: mockUser,
        channels: ['web_push']
      }));

      MockedWebPushService.sendNotification.mockResolvedValue({
        channel: 'web_push',
        success: true,
        externalId: 'push-123'
      });

      const startTime = Date.now();
      await AlertDeliveryService.bulkDeliverAlerts(largeAlertBatch);
      const endTime = Date.now();

      // Should process in batches with delays between them
      // 25 alerts in batches of 10 = 3 batches with 2 delays of 1 second each
      expect(endTime - startTime).toBeGreaterThan(2000);
    });
  });
});