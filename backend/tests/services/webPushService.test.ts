import { WebPushService } from '../../src/services/notifications/webPushService';
import { User } from '../../src/models/User';
import { IAlert, IUser } from '../../src/types/database';
import webpush from 'web-push';

// Mock dependencies
jest.mock('web-push');
jest.mock('../../src/models/User');
jest.mock('../../src/utils/logger');

const mockWebPush = webpush as jest.Mocked<typeof webpush>;
const mockUser = User as jest.Mocked<typeof User>;

describe('WebPushService', () => {
  const mockUserId = 'user-123';
  const mockAlertId = 'alert-456';
  
  const mockUser_data: Partial<IUser> = {
    id: mockUserId,
    email: 'test@example.com',
    push_subscriptions: [
      {
        id: 'sub-1',
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
        keys: {
          p256dh: 'test-p256dh-key',
          auth: 'test-auth-key'
        },
        createdAt: new Date(),
        lastUsed: new Date()
      }
    ]
  };

  const mockAlert: IAlert = {
    id: mockAlertId,
    user_id: mockUserId,
    product_id: 'product-123',
    retailer_id: 'retailer-456',
    type: 'restock',
    priority: 'high',
    status: 'pending',
    data: {
      product_name: 'Pokémon Booster Pack',
      retailer_name: 'Best Buy',
      price: 4.99,
      original_price: 5.99,
      availability_status: 'in_stock',
      product_url: 'https://bestbuy.com/product/123',
      cart_url: 'https://bestbuy.com/cart/add/123'
    },
    delivery_channels: ['web_push'],
    retry_count: 0,
    created_at: new Date(),
    updated_at: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup environment variables
    process.env.VAPID_PUBLIC_KEY = 'test-public-key';
    process.env.VAPID_PRIVATE_KEY = 'test-private-key';
    process.env.VAPID_SUBJECT = 'mailto:test@boosterbeacon.com';
  });

  afterEach(() => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
  });

  describe('sendNotification', () => {
    it('should send push notification successfully', async () => {
      // Arrange
      mockUser.findById.mockResolvedValue(mockUser_data as IUser);
      mockWebPush.sendNotification.mockResolvedValue({
        statusCode: 200,
        body: 'Success',
        headers: {}
      });

      // Act
      const result = await WebPushService.sendNotification(mockAlert, mockUser_data as IUser);

      // Assert
      expect(result.success).toBe(true);
      expect(result.channel).toBe('web_push');
      expect(mockWebPush.sendNotification).toHaveBeenCalledTimes(1);
      expect(mockWebPush.setVapidDetails).toHaveBeenCalledWith(
        'mailto:test@boosterbeacon.com',
        'test-public-key',
        'test-private-key'
      );
    });

    it('should handle missing VAPID keys', async () => {
      // Arrange
      delete process.env.VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;

      // Act
      const result = await WebPushService.sendNotification(mockAlert, mockUser_data as IUser);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Web push not configured');
      expect(mockWebPush.sendNotification).not.toHaveBeenCalled();
    });

    it('should handle user with no push subscriptions', async () => {
      // Arrange
      const userWithoutSubs = { ...mockUser_data, push_subscriptions: [] };
      mockUser.findById.mockResolvedValue(userWithoutSubs as IUser);

      // Act
      const result = await WebPushService.sendNotification(mockAlert, userWithoutSubs as IUser);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('No push subscriptions found for user');
      expect(mockWebPush.sendNotification).not.toHaveBeenCalled();
    });

    it('should handle push service failures', async () => {
      // Arrange
      mockUser.findById.mockResolvedValue(mockUser_data as IUser);
      mockWebPush.sendNotification.mockRejectedValue(new Error('Push service unavailable'));

      // Act
      const result = await WebPushService.sendNotification(mockAlert, mockUser_data as IUser);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to send to all 1 subscriptions');
    });

    it('should remove invalid subscriptions', async () => {
      // Arrange
      mockUser.findById.mockResolvedValue(mockUser_data as IUser);
      const invalidError = new Error('Invalid subscription');
      (invalidError as any).statusCode = 410; // Gone
      mockWebPush.sendNotification.mockRejectedValue(invalidError);
      mockUser.updateById.mockResolvedValue(mockUser_data as IUser);

      // Act
      const result = await WebPushService.sendNotification(mockAlert, mockUser_data as IUser);

      // Assert
      expect(result.success).toBe(false);
      expect(mockUser.updateById).toHaveBeenCalledWith(mockUserId, {
        push_subscriptions: []
      });
    });

    it('should create correct notification payload for restock alert', async () => {
      // Arrange
      mockUser.findById.mockResolvedValue(mockUser_data as IUser);
      mockWebPush.sendNotification.mockResolvedValue({
        statusCode: 200,
        body: 'Success',
        headers: {}
      });

      // Act
      await WebPushService.sendNotification(mockAlert, mockUser_data as IUser);

      // Assert
      const callArgs = mockWebPush.sendNotification.mock.calls[0];
      expect(callArgs).toBeDefined();
      const payload = JSON.parse(callArgs![1] as string);
      
      expect(payload.title).toBe('🔥 Pokémon Booster Pack Back in Stock!');
      expect(payload.body).toBe('Available now at Best Buy for $4.99');
      expect(payload.data.alertId).toBe(mockAlertId);
      expect(payload.data.cartUrl).toBe('https://bestbuy.com/cart/add/123');
      expect(payload.actions).toHaveLength(2);
      expect(payload.actions[0].action).toBe('cart');
      expect(payload.actions[1].action).toBe('view');
    });

    it('should create correct notification payload for price drop alert', async () => {
      // Arrange
      const priceDropAlert = {
        ...mockAlert,
        type: 'price_drop' as const
      };
      mockUser.findById.mockResolvedValue(mockUser_data as IUser);
      mockWebPush.sendNotification.mockResolvedValue({
        statusCode: 200,
        body: 'Success',
        headers: {}
      });

      // Act
      await WebPushService.sendNotification(priceDropAlert, mockUser_data as IUser);

      // Assert
      const callArgs = mockWebPush.sendNotification.mock.calls[0];
      expect(callArgs).toBeDefined();
      const payload = JSON.parse(callArgs![1] as string);
      
      expect(payload.title).toBe('💰 Price Drop: Pokémon Booster Pack');
      expect(payload.body).toBe('Now $4.99 at Best Buy (was $5.99)');
    });
  });

  describe('subscribe', () => {
    const mockSubscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/new-endpoint',
      keys: {
        p256dh: 'new-p256dh-key',
        auth: 'new-auth-key'
      }
    };

    it('should subscribe user successfully', async () => {
      // Arrange
      mockUser.findById.mockResolvedValue(mockUser_data as IUser);
      mockUser.updateById.mockResolvedValue(mockUser_data as IUser);

      // Act
      const result = await WebPushService.subscribe(mockUserId, mockSubscription);

      // Assert
      expect(result.success).toBe(true);
      expect(mockUser.updateById).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          push_subscriptions: expect.arrayContaining([
            expect.objectContaining({
              endpoint: mockSubscription.endpoint,
              keys: mockSubscription.keys
            })
          ])
        })
      );
    });

    it('should handle invalid subscription format', async () => {
      // Arrange
      const invalidSubscription = {
        endpoint: 'invalid-endpoint',
        keys: {} // Missing required keys
      };

      // Act
      const result = await WebPushService.subscribe(mockUserId, invalidSubscription as any);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid subscription format');
      expect(mockUser.updateById).not.toHaveBeenCalled();
    });

    it('should handle user not found', async () => {
      // Arrange
      mockUser.findById.mockResolvedValue(null);

      // Act
      const result = await WebPushService.subscribe(mockUserId, mockSubscription);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
      expect(mockUser.updateById).not.toHaveBeenCalled();
    });

    it('should update existing subscription', async () => {
      // Arrange
      const existingSubscription = mockUser_data.push_subscriptions![0];
      expect(existingSubscription).toBeDefined();
      const updatedSubscription = {
        ...mockSubscription,
        endpoint: existingSubscription!.endpoint // Same endpoint
      };
      mockUser.findById.mockResolvedValue(mockUser_data as IUser);
      mockUser.updateById.mockResolvedValue(mockUser_data as IUser);

      // Act
      const result = await WebPushService.subscribe(mockUserId, updatedSubscription);

      // Assert
      expect(result.success).toBe(true);
      expect(mockUser.updateById).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          push_subscriptions: expect.arrayContaining([
            expect.objectContaining({
              endpoint: existingSubscription!.endpoint,
              keys: updatedSubscription.keys
            })
          ])
        })
      );
    });
  });

  describe('unsubscribe', () => {
    const testEndpoint = 'https://fcm.googleapis.com/fcm/send/test-endpoint';

    it('should unsubscribe user successfully', async () => {
      // Arrange
      mockUser.findById.mockResolvedValue(mockUser_data as IUser);
      mockUser.updateById.mockResolvedValue(mockUser_data as IUser);

      // Act
      const result = await WebPushService.unsubscribe(mockUserId, testEndpoint);

      // Assert
      expect(result.success).toBe(true);
      expect(mockUser.updateById).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          push_subscriptions: []
        })
      );
    });

    it('should handle user with no subscriptions', async () => {
      // Arrange
      const userWithoutSubs = { ...mockUser_data, push_subscriptions: [] };
      mockUser.findById.mockResolvedValue(userWithoutSubs as IUser);

      // Act
      const result = await WebPushService.unsubscribe(mockUserId, testEndpoint);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('No subscriptions found');
      expect(mockUser.updateById).not.toHaveBeenCalled();
    });

    it('should handle subscription not found', async () => {
      // Arrange
      mockUser.findById.mockResolvedValue(mockUser_data as IUser);

      // Act
      const result = await WebPushService.unsubscribe(mockUserId, 'non-existent-endpoint');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Subscription not found');
      expect(mockUser.updateById).not.toHaveBeenCalled();
    });
  });

  describe('sendTestNotification', () => {
    it('should send test notification successfully', async () => {
      // Arrange
      mockUser.findById.mockResolvedValue(mockUser_data as IUser);
      mockWebPush.sendNotification.mockResolvedValue({
        statusCode: 200,
        body: 'Success',
        headers: {}
      });

      // Act
      const result = await WebPushService.sendTestNotification(mockUserId);

      // Assert
      expect(result.success).toBe(true);
      expect(mockWebPush.sendNotification).toHaveBeenCalledTimes(1);
      
      const callArgs = mockWebPush.sendNotification.mock.calls[0];
      expect(callArgs).toBeDefined();
      const payload = JSON.parse(callArgs![1] as string);
      expect(payload.title).toBe('🧪 BoosterBeacon Test');
      expect(payload.body).toBe('Your notifications are working perfectly!');
    });

    it('should handle user with no subscriptions', async () => {
      // Arrange
      const userWithoutSubs = { ...mockUser_data, push_subscriptions: [] };
      mockUser.findById.mockResolvedValue(userWithoutSubs as IUser);

      // Act
      const result = await WebPushService.sendTestNotification(mockUserId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('No push subscriptions found');
      expect(mockWebPush.sendNotification).not.toHaveBeenCalled();
    });
  });

  describe('getUserPushStats', () => {
    it('should return user push statistics', async () => {
      // Arrange
      mockUser.findById.mockResolvedValue(mockUser_data as IUser);

      // Act
      const stats = await WebPushService.getUserPushStats(mockUserId);

      // Assert
      expect(stats.subscriptionCount).toBe(1);
      expect(stats.notificationsSent).toBe(0);
      expect(stats.lastNotificationSent).toBeUndefined();
    });

    it('should handle user not found', async () => {
      // Arrange
      mockUser.findById.mockResolvedValue(null);

      // Act
      const stats = await WebPushService.getUserPushStats(mockUserId);

      // Assert
      expect(stats.subscriptionCount).toBe(0);
      expect(stats.notificationsSent).toBe(0);
    });
  });
});