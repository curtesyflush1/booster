import { AlertProcessingService, AlertGenerationData } from '../../src/services/alertProcessingService';
import { Alert } from '../../src/models/Alert';
import { User } from '../../src/models/User';
import { Product } from '../../src/models/Product';
import { Watch } from '../../src/models/Watch';
import { QuietHoursService } from '../../src/services/quietHoursService';
import { AlertDeliveryService } from '../../src/services/alertDeliveryService';
import { IAlert, IUser, IProduct, IWatch } from '../../src/types/database';
import { SubscriptionTier } from '../../src/types/subscription';

// Mock dependencies
jest.mock('../../src/models/Alert');
jest.mock('../../src/models/User');
jest.mock('../../src/models/Product');
jest.mock('../../src/models/Watch');
jest.mock('../../src/services/quietHoursService');
jest.mock('../../src/services/alertDeliveryService');

const MockedAlert = Alert as jest.Mocked<typeof Alert>;
const MockedUser = User as jest.Mocked<typeof User>;
const MockedProduct = Product as jest.Mocked<typeof Product>;
const MockedWatch = Watch as jest.Mocked<typeof Watch>;
const MockedQuietHoursService = QuietHoursService as jest.Mocked<typeof QuietHoursService>;
const MockedAlertDeliveryService = AlertDeliveryService as jest.Mocked<typeof AlertDeliveryService>;

describe('AlertProcessingService', () => {
  const mockUser: IUser = {
    id: 'user-1',
    email: 'test@example.com',
    password_hash: 'hashed',
    subscription_tier: SubscriptionTier.FREE,
    email_verified: true,
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

  const mockProduct: IProduct = {
    id: 'product-1',
    name: 'Test Product',
    slug: 'test-product',
    is_active: true,
    popularity_score: 500,
    metadata: {},
    created_at: new Date(),
    updated_at: new Date()
  };

  const mockWatch: IWatch = {
    id: 'watch-1',
    user_id: 'user-1',
    product_id: 'product-1',
    retailer_ids: ['retailer-1'],
    availability_type: 'both',
    is_active: true,
    alert_preferences: {},
    alert_count: 0,
    created_at: new Date(),
    updated_at: new Date()
  };

  const mockAlertData: AlertGenerationData = {
    userId: 'user-1',
    productId: 'product-1',
    retailerId: 'retailer-1',
    watchId: 'watch-1',
    type: 'restock',
    data: {
      product_name: 'Test Product',
      retailer_name: 'Test Retailer',
      availability_status: 'in_stock',
      product_url: 'https://example.com/product'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    MockedUser.findById.mockResolvedValue(mockUser);
    MockedProduct.findById.mockResolvedValue(mockProduct);
    MockedWatch.findById.mockResolvedValue(mockWatch);
    MockedQuietHoursService.isQuietTime.mockResolvedValue({ isQuietTime: false });
  });

  describe('generateAlert', () => {
    it('should generate and process alert successfully', async () => {
      const mockAlert: IAlert = {
        id: 'alert-1',
        user_id: 'user-1',
        product_id: 'product-1',
        retailer_id: 'retailer-1',
        watch_id: 'watch-1',
        type: 'restock',
        priority: 'medium',
        data: mockAlertData.data,
        status: 'pending',
        delivery_channels: [],
        retry_count: 0,
        created_at: new Date(),
        updated_at: new Date()
      };

      MockedAlert.createAlert.mockResolvedValue(mockAlert);
      MockedAlert.findBy.mockResolvedValue([]);
      MockedAlertDeliveryService.deliverAlert.mockResolvedValue({
        success: true,
        successfulChannels: ['web_push', 'email'],
        failedChannels: [],
        deliveryIds: ['delivery-1']
      });
      MockedAlert.markAsSent.mockResolvedValue(true);

      const result = await AlertProcessingService.generateAlert(mockAlertData);

      expect(result.status).toBe('processed');
      expect(result.alertId).toBe('alert-1');
      expect(result.deliveryChannels).toEqual(['web_push', 'email']);
      expect(MockedAlert.createAlert).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user-1',
        product_id: 'product-1',
        retailer_id: 'retailer-1',
        type: 'restock'
      }));
    });

    it('should schedule alert during quiet hours', async () => {
      const nextActiveTime = new Date(Date.now() + 60 * 60 * 1000);
      MockedQuietHoursService.isQuietTime.mockResolvedValue({
        isQuietTime: true,
        nextActiveTime,
        reason: 'Quiet hours active'
      });

      const mockAlert: IAlert = {
        id: 'alert-1',
        user_id: 'user-1',
        product_id: 'product-1',
        retailer_id: 'retailer-1',
        type: 'restock',
        priority: 'medium',
        data: mockAlertData.data,
        status: 'pending',
        delivery_channels: [],
        retry_count: 0,
        created_at: new Date(),
        updated_at: new Date()
      };

      MockedAlert.createAlert.mockResolvedValue(mockAlert);
      MockedAlert.findBy.mockResolvedValue([]);
      MockedAlert.updateById.mockResolvedValue(mockAlert);

      const result = await AlertProcessingService.generateAlert(mockAlertData);

      expect(result.status).toBe('scheduled');
      expect(result.scheduledFor).toEqual(nextActiveTime);
      expect(MockedAlert.updateById).toHaveBeenCalledWith('alert-1', {
        scheduled_for: nextActiveTime,
        status: 'pending'
      });
    });

    it('should deduplicate similar alerts', async () => {
      const existingAlert: IAlert = {
        id: 'existing-alert',
        user_id: 'user-1',
        product_id: 'product-1',
        retailer_id: 'retailer-1',
        type: 'restock',
        priority: 'medium',
        data: mockAlertData.data,
        status: 'sent',
        delivery_channels: [],
        retry_count: 0,
        created_at: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        updated_at: new Date()
      };

      MockedAlert.findBy.mockResolvedValue([existingAlert]);

      const result = await AlertProcessingService.generateAlert(mockAlertData);

      expect(result.status).toBe('deduplicated');
      expect(result.alertId).toBe('existing-alert');
      expect(MockedAlert.createAlert).not.toHaveBeenCalled();
    });

    it('should reject alert for non-existent user', async () => {
      MockedUser.findById.mockResolvedValue(null);

      await expect(AlertProcessingService.generateAlert(mockAlertData))
        .rejects.toThrow('Alert validation failed: User not found');
    });

    it('should reject alert for inactive product', async () => {
      MockedProduct.findById.mockResolvedValue({
        ...mockProduct,
        is_active: false
      });

      await expect(AlertProcessingService.generateAlert(mockAlertData))
        .rejects.toThrow('Alert validation failed: Product is inactive');
    });

    it('should handle rate limiting', async () => {
      // Create many recent alerts to trigger rate limit
      const recentAlerts = Array.from({ length: 51 }, (_, i) => ({
        id: `alert-${i}`,
        user_id: 'user-1',
        product_id: 'product-1',
        retailer_id: 'retailer-1',
        type: 'restock' as const,
        priority: 'medium' as const,
        data: mockAlertData.data,
        status: 'sent' as const,
        delivery_channels: [],
        retry_count: 0,
        created_at: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        updated_at: new Date()
      }));

      MockedAlert.findBy.mockResolvedValue(recentAlerts);

      await expect(AlertProcessingService.generateAlert(mockAlertData))
        .rejects.toThrow('Rate limit exceeded');
    });

    it('should calculate priority based on product popularity', async () => {
      const highPopularityProduct = {
        ...mockProduct,
        popularity_score: 900
      };
      MockedProduct.findById.mockResolvedValue(highPopularityProduct);

      const mockAlert: IAlert = {
        id: 'alert-1',
        user_id: 'user-1',
        product_id: 'product-1',
        retailer_id: 'retailer-1',
        type: 'restock',
        priority: 'urgent',
        data: mockAlertData.data,
        status: 'pending',
        delivery_channels: [],
        retry_count: 0,
        created_at: new Date(),
        updated_at: new Date()
      };

      MockedAlert.createAlert.mockResolvedValue(mockAlert);
      MockedAlert.findBy.mockResolvedValue([]);
      MockedAlertDeliveryService.deliverAlert.mockResolvedValue({
        success: true,
        successfulChannels: ['web_push'],
        failedChannels: [],
        deliveryIds: ['delivery-1']
      });

      await AlertProcessingService.generateAlert(mockAlertData);

      expect(MockedAlert.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'urgent'
        })
      );
    });
  });

  describe('processPendingAlerts', () => {
    it('should process multiple pending alerts', async () => {
      const pendingAlerts: IAlert[] = [
        {
          id: 'alert-1',
          user_id: 'user-1',
          product_id: 'product-1',
          retailer_id: 'retailer-1',
          type: 'restock',
          priority: 'medium',
          data: mockAlertData.data,
          status: 'pending',
          delivery_channels: [],
          retry_count: 0,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: 'alert-2',
          user_id: 'user-1',
          product_id: 'product-1',
          retailer_id: 'retailer-2',
          type: 'price_drop',
          priority: 'high',
          data: mockAlertData.data,
          status: 'pending',
          delivery_channels: [],
          retry_count: 0,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      MockedAlert.getPendingAlerts.mockResolvedValue(pendingAlerts);
      MockedAlert.findById.mockImplementation(async (id) => 
        pendingAlerts.find(alert => alert.id === id) || null
      );
      MockedAlertDeliveryService.deliverAlert.mockResolvedValue({
        success: true,
        successfulChannels: ['web_push'],
        failedChannels: [],
        deliveryIds: ['delivery-1']
      });
      MockedAlert.markAsSent.mockResolvedValue(true);

      const result = await AlertProcessingService.processPendingAlerts();

      expect(result.processed).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.scheduled).toBe(0);
      expect(MockedAlert.getPendingAlerts).toHaveBeenCalledWith(100);
    });

    it('should handle processing failures gracefully', async () => {
      const pendingAlerts: IAlert[] = [
        {
          id: 'alert-1',
          user_id: 'user-1',
          product_id: 'product-1',
          retailer_id: 'retailer-1',
          type: 'restock',
          priority: 'medium',
          data: mockAlertData.data,
          status: 'pending',
          delivery_channels: [],
          retry_count: 0,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      MockedAlert.getPendingAlerts.mockResolvedValue(pendingAlerts);
      MockedAlert.findById.mockResolvedValue(pendingAlerts[0]);
      MockedAlertDeliveryService.deliverAlert.mockResolvedValue({
        success: false,
        successfulChannels: [],
        failedChannels: ['web_push'],
        error: 'Delivery failed',
        deliveryIds: []
      });
      MockedAlert.markAsFailed.mockResolvedValue(true);

      const result = await AlertProcessingService.processPendingAlerts();

      expect(result.processed).toBe(0);
      expect(result.failed).toBe(1);
      expect(MockedAlert.markAsFailed).toHaveBeenCalledWith('alert-1', 'Delivery failed');
    });
  });

  describe('processAlert', () => {
    it('should process individual alert successfully', async () => {
      const mockAlert: IAlert = {
        id: 'alert-1',
        user_id: 'user-1',
        product_id: 'product-1',
        retailer_id: 'retailer-1',
        watch_id: 'watch-1',
        type: 'restock',
        priority: 'medium',
        data: mockAlertData.data,
        status: 'pending',
        delivery_channels: [],
        retry_count: 0,
        created_at: new Date(),
        updated_at: new Date()
      };

      MockedAlert.findById.mockResolvedValue(mockAlert);
      MockedAlertDeliveryService.deliverAlert.mockResolvedValue({
        success: true,
        successfulChannels: ['web_push', 'email'],
        failedChannels: [],
        deliveryIds: ['delivery-1']
      });
      MockedAlert.markAsSent.mockResolvedValue(true);
      MockedWatch.updateById.mockResolvedValue(mockWatch);

      const result = await AlertProcessingService.processAlert('alert-1');

      expect(result.success).toBe(true);
      expect(result.deliveryChannels).toEqual(['web_push', 'email']);
      expect(MockedAlert.markAsSent).toHaveBeenCalledWith('alert-1', ['web_push', 'email']);
      expect(MockedWatch.updateById).toHaveBeenCalledWith('watch-1', {
        alert_count: 1,
        last_alerted: expect.any(Date)
      });
    });

    it('should reschedule alert during quiet hours', async () => {
      const mockAlert: IAlert = {
        id: 'alert-1',
        user_id: 'user-1',
        product_id: 'product-1',
        retailer_id: 'retailer-1',
        type: 'restock',
        priority: 'medium',
        data: mockAlertData.data,
        status: 'pending',
        delivery_channels: [],
        retry_count: 0,
        created_at: new Date(),
        updated_at: new Date()
      };

      const nextActiveTime = new Date(Date.now() + 60 * 60 * 1000);
      MockedAlert.findById.mockResolvedValue(mockAlert);
      MockedQuietHoursService.isQuietTime.mockResolvedValue({
        isQuietTime: true,
        nextActiveTime,
        reason: 'Quiet hours active'
      });
      MockedAlert.updateById.mockResolvedValue(mockAlert);

      const result = await AlertProcessingService.processAlert('alert-1');

      expect(result.success).toBe(false);
      expect(result.rescheduled).toBe(true);
      expect(MockedAlert.updateById).toHaveBeenCalledWith('alert-1', {
        scheduled_for: nextActiveTime
      });
    });

    it('should handle missing user', async () => {
      const mockAlert: IAlert = {
        id: 'alert-1',
        user_id: 'user-1',
        product_id: 'product-1',
        retailer_id: 'retailer-1',
        type: 'restock',
        priority: 'medium',
        data: mockAlertData.data,
        status: 'pending',
        delivery_channels: [],
        retry_count: 0,
        created_at: new Date(),
        updated_at: new Date()
      };

      MockedAlert.findById.mockResolvedValue(mockAlert);
      MockedUser.findById.mockResolvedValue(null);
      MockedAlert.markAsFailed.mockResolvedValue(true);

      const result = await AlertProcessingService.processAlert('alert-1');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('User not found');
      expect(MockedAlert.markAsFailed).toHaveBeenCalledWith('alert-1', 'User not found');
    });
  });

  describe('retryFailedAlerts', () => {
    it('should retry failed alerts successfully', async () => {
      const failedAlerts: IAlert[] = [
        {
          id: 'alert-1',
          user_id: 'user-1',
          product_id: 'product-1',
          retailer_id: 'retailer-1',
          type: 'restock',
          priority: 'medium',
          data: mockAlertData.data,
          status: 'failed',
          delivery_channels: [],
          retry_count: 1,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      MockedAlert.getFailedAlertsForRetry.mockResolvedValue(failedAlerts);
      MockedAlert.findById.mockResolvedValue(failedAlerts[0]);
      MockedAlertDeliveryService.deliverAlert.mockResolvedValue({
        success: true,
        successfulChannels: ['web_push'],
        failedChannels: [],
        deliveryIds: ['delivery-1']
      });
      MockedAlert.markAsSent.mockResolvedValue(true);

      const result = await AlertProcessingService.retryFailedAlerts();

      expect(result.retried).toBe(1);
      expect(result.succeeded).toBe(1);
      expect(result.permanentlyFailed).toBe(0);
    });

    it('should mark alerts as permanently failed after max retries', async () => {
      const failedAlerts: IAlert[] = [
        {
          id: 'alert-1',
          user_id: 'user-1',
          product_id: 'product-1',
          retailer_id: 'retailer-1',
          type: 'restock',
          priority: 'medium',
          data: mockAlertData.data,
          status: 'failed',
          delivery_channels: [],
          retry_count: 2, // At max retry limit
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      MockedAlert.getFailedAlertsForRetry.mockResolvedValue(failedAlerts);
      MockedAlert.findById.mockResolvedValue(failedAlerts[0]);
      MockedAlertDeliveryService.deliverAlert.mockResolvedValue({
        success: false,
        successfulChannels: [],
        failedChannels: ['web_push'],
        error: 'Still failing',
        deliveryIds: []
      });
      MockedAlert.updateById.mockResolvedValue(failedAlerts[0]);

      const result = await AlertProcessingService.retryFailedAlerts();

      expect(result.retried).toBe(1);
      expect(result.succeeded).toBe(0);
      expect(result.permanentlyFailed).toBe(1);
      expect(MockedAlert.updateById).toHaveBeenCalledWith('alert-1', {
        status: 'failed',
        failure_reason: 'Max retry attempts exceeded'
      });
    });
  });

  describe('getProcessingStats', () => {
    it('should return processing statistics', async () => {
      const pendingAlerts: IAlert[] = [
        {
          id: 'alert-1',
          user_id: 'user-1',
          product_id: 'product-1',
          retailer_id: 'retailer-1',
          type: 'restock',
          priority: 'medium',
          data: mockAlertData.data,
          status: 'pending',
          delivery_channels: [],
          retry_count: 0,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      const failedAlerts: IAlert[] = [
        {
          id: 'alert-2',
          user_id: 'user-1',
          product_id: 'product-1',
          retailer_id: 'retailer-1',
          type: 'restock',
          priority: 'medium',
          data: mockAlertData.data,
          status: 'failed',
          delivery_channels: [],
          retry_count: 1,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      const todayAlerts: IAlert[] = [
        {
          id: 'alert-3',
          user_id: 'user-1',
          product_id: 'product-1',
          retailer_id: 'retailer-1',
          type: 'restock',
          priority: 'medium',
          data: mockAlertData.data,
          status: 'sent',
          delivery_channels: ['web_push'],
          retry_count: 0,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      MockedAlert.getPendingAlerts.mockResolvedValue(pendingAlerts);
      MockedAlert.getFailedAlertsForRetry.mockResolvedValue(failedAlerts);
      MockedAlert.findBy.mockResolvedValue(todayAlerts);

      const stats = await AlertProcessingService.getProcessingStats();

      expect(stats.pendingAlerts).toBe(1);
      expect(stats.failedAlerts).toBe(1);
      expect(stats.alertsProcessedToday).toBe(1);
      expect(stats.successRate).toBe(100); // 1 sent, 1 total processed
    });
  });
});