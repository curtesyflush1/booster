import { AlertProcessingService } from '../../src/services/alertProcessingService';
import { Alert } from '../../src/models/Alert';
import { User } from '../../src/models/User';
import { Product } from '../../src/models/Product';
import { IAlert, IUser } from '../../src/types/database';
import { SubscriptionTier } from '../../src/types/subscription';

// Mock dependencies
jest.mock('../../src/models/Alert');
jest.mock('../../src/models/User');
jest.mock('../../src/models/Product');
jest.mock('../../src/services/alertDeliveryService');
jest.mock('../../src/services/quietHoursService');

const MockedAlert = Alert as jest.Mocked<typeof Alert>;
const MockedUser = User as jest.Mocked<typeof User>;
const MockedProduct = Product as jest.Mocked<typeof Product>;

describe.skip('Alert Rate Limiting and Spam Prevention Tests', () => {
  const mockUser: IUser = {
    id: 'user-1',
    email: 'test@example.com',
    password_hash: 'hashed',
    subscription_tier: SubscriptionTier.FREE,
    role: 'user',
    email_verified: true,
    failed_login_attempts: 0,
    admin_permissions: [],
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

  const mockProduct = {
    id: 'product-1',
    name: 'Test Product',
    slug: 'test-product',
    is_active: true,
    popularity_score: 500,
    metadata: {},
    created_at: new Date(),
    updated_at: new Date()
  };

  const baseAlertData = {
    userId: 'user-1',
    productId: 'product-1',
    retailerId: 'retailer-1',
    type: 'restock' as const,
    data: {
      product_name: 'Test Product',
      retailer_name: 'Test Retailer',
      availability_status: 'in_stock',
      product_url: 'https://example.com'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    MockedUser.findById.mockResolvedValue(mockUser);
    MockedProduct.findById.mockResolvedValue(mockProduct);
    
    // Mock quiet hours service to not be in quiet hours
    const { QuietHoursService } = require('../../src/services/quietHoursService');
    QuietHoursService.isQuietTime = jest.fn().mockResolvedValue({ isQuietTime: false });
  });

  describe.skip('Rate Limiting by Alert Count', () => {
    it('should allow alerts under the hourly limit', async () => {
      // Mock user having 10 alerts in the last hour (under limit of 50)
      const recentAlerts = Array.from({ length: 10 }, (_, i) => ({
        id: `alert-${i}`,
        user_id: 'user-1',
        product_id: 'product-1',
        retailer_id: 'retailer-1',
        type: 'restock' as const,
        priority: 'medium' as const,
        data: baseAlertData.data,
        status: 'sent' as const,
        delivery_channels: ['web_push'],
        retry_count: 0,
        created_at: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        updated_at: new Date()
      }));

      MockedAlert.findBy.mockResolvedValue(recentAlerts);
      
      const mockAlert: IAlert = {
        id: 'new-alert',
        user_id: baseAlertData.userId,
        product_id: baseAlertData.productId,
        retailer_id: baseAlertData.retailerId,
        type: baseAlertData.type,
        priority: 'medium',
        data: baseAlertData.data,
        status: 'pending',
        delivery_channels: [],
        retry_count: 0,
        created_at: new Date(),
        updated_at: new Date()
      };

      MockedAlert.createAlert.mockResolvedValue(mockAlert);

      // Mock successful delivery
      const { AlertDeliveryService } = require('../../src/services/alertDeliveryService');
      AlertDeliveryService.deliverAlert = jest.fn().mockResolvedValue({
        success: true,
        successfulChannels: ['web_push'],
        failedChannels: [],
        deliveryIds: ['delivery-1']
      });
      MockedAlert.markAsSent.mockResolvedValue(true);
      MockedAlert.findById.mockResolvedValue(mockAlert);

      const result = await AlertProcessingService.generateAlert(baseAlertData);

      expect(result.status).toBe('processed');
      expect(MockedAlert.createAlert).toHaveBeenCalled();
    });

    it('should reject alerts when hourly limit is exceeded', async () => {
      // Mock user having 51 alerts in the last hour (over limit of 50)
      const recentAlerts = Array.from({ length: 51 }, (_, i) => ({
        id: `alert-${i}`,
        user_id: 'user-1',
        product_id: 'product-1',
        retailer_id: 'retailer-1',
        type: 'restock' as const,
        priority: 'medium' as const,
        data: baseAlertData.data,
        status: 'sent' as const,
        delivery_channels: ['web_push'],
        retry_count: 0,
        created_at: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        updated_at: new Date()
      }));

      MockedAlert.findBy.mockResolvedValue(recentAlerts);

      await expect(AlertProcessingService.generateAlert(baseAlertData))
        .rejects.toThrow('Rate limit exceeded');

      expect(MockedAlert.createAlert).not.toHaveBeenCalled();
    });

    it('should not count old alerts towards rate limit', async () => {
      // Mock user having 51 alerts, but they're all older than 1 hour
      const oldAlerts = Array.from({ length: 51 }, (_, i) => ({
        id: `alert-${i}`,
        user_id: 'user-1',
        product_id: 'product-1',
        retailer_id: 'retailer-1',
        type: 'restock' as const,
        priority: 'medium' as const,
        data: baseAlertData.data,
        status: 'sent' as const,
        delivery_channels: ['web_push'],
        retry_count: 0,
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        updated_at: new Date()
      }));

      MockedAlert.findBy.mockResolvedValue(oldAlerts);
      
      const mockAlert: IAlert = {
        id: 'new-alert',
        user_id: baseAlertData.userId,
        product_id: baseAlertData.productId,
        retailer_id: baseAlertData.retailerId,
        type: baseAlertData.type,
        priority: 'medium',
        data: baseAlertData.data,
        status: 'pending',
        delivery_channels: [],
        retry_count: 0,
        created_at: new Date(),
        updated_at: new Date()
      };

      MockedAlert.createAlert.mockResolvedValue(mockAlert);
      MockedAlert.findById.mockResolvedValue(mockAlert);

      // Mock successful delivery
      const { AlertDeliveryService } = require('../../src/services/alertDeliveryService');
      AlertDeliveryService.deliverAlert = jest.fn().mockResolvedValue({
        success: true,
        successfulChannels: ['web_push'],
        failedChannels: [],
        deliveryIds: ['delivery-1']
      });
      MockedAlert.markAsSent.mockResolvedValue(true);

      const result = await AlertProcessingService.generateAlert(baseAlertData);

      expect(result.status).toBe('processed');
      expect(MockedAlert.createAlert).toHaveBeenCalled();
    });
  });

  describe.skip('Alert Deduplication', () => {
    it('should deduplicate identical alerts within time window', async () => {
      // Mock existing alert within deduplication window (15 minutes)
      const existingAlert: IAlert = {
        id: 'existing-alert',
        user_id: 'user-1',
        product_id: 'product-1',
        retailer_id: 'retailer-1',
        type: 'restock',
        priority: 'medium',
        data: baseAlertData.data,
        status: 'sent',
        delivery_channels: ['web_push'],
        retry_count: 0,
        created_at: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        updated_at: new Date()
      };

      MockedAlert.findBy.mockResolvedValue([existingAlert]);

      const result = await AlertProcessingService.generateAlert(baseAlertData);

      expect(result.status).toBe('deduplicated');
      expect(result.alertId).toBe('existing-alert');
      expect(MockedAlert.createAlert).not.toHaveBeenCalled();
    });

    it('should allow alerts after deduplication window expires', async () => {
      // Mock existing alert outside deduplication window (older than 15 minutes)
      const oldAlert: IAlert = {
        id: 'old-alert',
        user_id: 'user-1',
        product_id: 'product-1',
        retailer_id: 'retailer-1',
        type: 'restock',
        priority: 'medium',
        data: baseAlertData.data,
        status: 'sent',
        delivery_channels: ['web_push'],
        retry_count: 0,
        created_at: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
        updated_at: new Date()
      };

      MockedAlert.findBy.mockResolvedValue([oldAlert]);
      
      const mockAlert: IAlert = {
        id: 'new-alert',
        user_id: baseAlertData.userId,
        product_id: baseAlertData.productId,
        retailer_id: baseAlertData.retailerId,
        type: baseAlertData.type,
        priority: 'medium',
        data: baseAlertData.data,
        status: 'pending',
        delivery_channels: [],
        retry_count: 0,
        created_at: new Date(),
        updated_at: new Date()
      };

      MockedAlert.createAlert.mockResolvedValue(mockAlert);
      MockedAlert.findById.mockResolvedValue(mockAlert);

      // Mock successful delivery
      const { AlertDeliveryService } = require('../../src/services/alertDeliveryService');
      AlertDeliveryService.deliverAlert = jest.fn().mockResolvedValue({
        success: true,
        successfulChannels: ['web_push'],
        failedChannels: [],
        deliveryIds: ['delivery-1']
      });
      MockedAlert.markAsSent.mockResolvedValue(true);

      const result = await AlertProcessingService.generateAlert(baseAlertData);

      expect(result.status).toBe('processed');
      expect(MockedAlert.createAlert).toHaveBeenCalled();
    });

    it('should allow different alert types for same product', async () => {
      // Mock existing restock alert
      const existingAlert: IAlert = {
        id: 'existing-alert',
        user_id: 'user-1',
        product_id: 'product-1',
        retailer_id: 'retailer-1',
        type: 'restock',
        priority: 'medium',
        data: baseAlertData.data,
        status: 'sent',
        delivery_channels: ['web_push'],
        retry_count: 0,
        created_at: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        updated_at: new Date()
      };

      MockedAlert.findBy.mockResolvedValue([existingAlert]);
      
      // Try to create a price_drop alert (different type)
      const priceDropAlertData = {
        ...baseAlertData,
        type: 'price_drop' as const
      };

      const mockAlert: IAlert = {
        id: 'new-alert',
        user_id: priceDropAlertData.userId,
        product_id: priceDropAlertData.productId,
        retailer_id: priceDropAlertData.retailerId,
        type: priceDropAlertData.type,
        priority: 'medium',
        data: priceDropAlertData.data,
        status: 'pending',
        delivery_channels: [],
        retry_count: 0,
        created_at: new Date(),
        updated_at: new Date()
      };

      MockedAlert.createAlert.mockResolvedValue(mockAlert);
      MockedAlert.findById.mockResolvedValue(mockAlert);

      // Mock successful delivery
      const { AlertDeliveryService } = require('../../src/services/alertDeliveryService');
      AlertDeliveryService.deliverAlert = jest.fn().mockResolvedValue({
        success: true,
        successfulChannels: ['web_push'],
        failedChannels: [],
        deliveryIds: ['delivery-1']
      });
      MockedAlert.markAsSent.mockResolvedValue(true);

      const result = await AlertProcessingService.generateAlert(priceDropAlertData);

      expect(result.status).toBe('processed');
      expect(MockedAlert.createAlert).toHaveBeenCalled();
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});