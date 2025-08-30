import { AlertProcessingService } from '../../src/services/alertProcessingService';
import { QuietHoursService } from '../../src/services/quietHoursService';
import { Alert } from '../../src/models/Alert';
import { User } from '../../src/models/User';
import { Product } from '../../src/models/Product';
import { IUser, IQuietHours } from '../../src/types/database';
import { SubscriptionTier } from '../../src/types/subscription';

// Mock dependencies
jest.mock('../../src/models/Alert');
jest.mock('../../src/models/User');
jest.mock('../../src/models/Product');
jest.mock('../../src/services/alertDeliveryService');

const MockedAlert = Alert as jest.Mocked<typeof Alert>;
const MockedUser = User as jest.Mocked<typeof User>;
const MockedProduct = Product as jest.Mocked<typeof Product>;

describe('Quiet Hours Filtering Tests', () => {
  const baseUser: IUser = {
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
    role: 'user',
    admin_permissions: [],
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

  beforeEach(() => {
    jest.clearAllMocks();
    MockedUser.findById.mockResolvedValue(baseUser);
    MockedProduct.findById.mockResolvedValue(mockProduct);
    MockedAlert.findBy.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 10
    });
  });

  describe('QuietHoursService.isQuietTime', () => {
    it('should return false when quiet hours are disabled', async () => {
      const user = {
        ...baseUser,
        quiet_hours: {
          ...baseUser.quiet_hours,
          enabled: false
        }
      };
      MockedUser.findById.mockResolvedValue(user);

      const result = await QuietHoursService.isQuietTime('user-1');

      expect(result.isQuietTime).toBe(false);
      expect(result.reason).toBe('Quiet hours disabled');
    });

    it('should detect quiet hours during same-day period', async () => {
      const user = {
        ...baseUser,
        quiet_hours: {
          enabled: true,
          start_time: '14:00',
          end_time: '16:00',
          timezone: 'UTC',
          days: []
        }
      };
      MockedUser.findById.mockResolvedValue(user);

      // Mock current time to be 15:00 UTC
      const mockDate = new Date('2024-01-01T15:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());

      const result = await QuietHoursService.isQuietTime('user-1');

      expect(result.isQuietTime).toBe(true);
      expect(result.reason).toContain('Quiet hours: 14:00 - 16:00');
    });

    it('should detect overnight quiet hours', async () => {
      const user = {
        ...baseUser,
        quiet_hours: {
          enabled: true,
          start_time: '22:00',
          end_time: '08:00',
          timezone: 'UTC',
          days: []
        }
      };
      MockedUser.findById.mockResolvedValue(user);

      // Mock current time to be 23:00 UTC (during overnight quiet hours)
      const mockDate = new Date('2024-01-01T23:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());

      const result = await QuietHoursService.isQuietTime('user-1');

      expect(result.isQuietTime).toBe(true);
      expect(result.reason).toContain('overnight');
    });

    it('should detect early morning quiet hours', async () => {
      const user = {
        ...baseUser,
        quiet_hours: {
          enabled: true,
          start_time: '22:00',
          end_time: '08:00',
          timezone: 'UTC',
          days: []
        }
      };
      MockedUser.findById.mockResolvedValue(user);

      // Mock current time to be 07:00 UTC (during overnight quiet hours)
      const mockDate = new Date('2024-01-01T07:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());

      const result = await QuietHoursService.isQuietTime('user-1');

      expect(result.isQuietTime).toBe(true);
      expect(result.reason).toContain('overnight');
    });

    it('should respect specific quiet days', async () => {
      const user = {
        ...baseUser,
        quiet_hours: {
          enabled: true,
          start_time: '00:00',
          end_time: '23:59',
          timezone: 'UTC',
          days: [0, 6] // Sunday and Saturday only
        }
      };
      MockedUser.findById.mockResolvedValue(user);

      // Mock current time to be Monday (day 1)
      const mondayDate = new Date('2024-01-01T12:00:00Z'); // Monday
      jest.spyOn(Date, 'now').mockReturnValue(mondayDate.getTime());

      const result = await QuietHoursService.isQuietTime('user-1');

      expect(result.isQuietTime).toBe(false);
      expect(result.reason).toBe('Not a quiet day');
    });

    it('should handle timezone conversions correctly', async () => {
      const user = {
        ...baseUser,
        quiet_hours: {
          enabled: true,
          start_time: '22:00',
          end_time: '08:00',
          timezone: 'America/New_York', // EST/EDT
          days: []
        }
      };
      MockedUser.findById.mockResolvedValue(user);

      // Mock current time to be 3:00 AM UTC (which is 10:00 PM EST - during quiet hours)
      const mockDate = new Date('2024-01-01T03:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());

      const result = await QuietHoursService.isQuietTime('user-1');

      expect(result.isQuietTime).toBe(true);
    });

    it('should calculate next active time correctly', async () => {
      const user = {
        ...baseUser,
        quiet_hours: {
          enabled: true,
          start_time: '22:00',
          end_time: '08:00',
          timezone: 'UTC',
          days: []
        }
      };
      MockedUser.findById.mockResolvedValue(user);

      // Mock current time to be 23:00 UTC
      const mockDate = new Date('2024-01-01T23:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());

      const result = await QuietHoursService.isQuietTime('user-1');

      expect(result.isQuietTime).toBe(true);
      expect(result.nextActiveTime).toBeDefined();
      
      // Next active time should be 08:00 the next day
      const expectedNextActive = new Date('2024-01-02T08:00:00Z');
      expect(result.nextActiveTime?.getTime()).toBeCloseTo(expectedNextActive.getTime(), -3);
    });

    it('should handle invalid timezone gracefully', async () => {
      const user = {
        ...baseUser,
        quiet_hours: {
          enabled: true,
          start_time: '22:00',
          end_time: '08:00',
          timezone: 'Invalid/Timezone',
          days: []
        }
      };
      MockedUser.findById.mockResolvedValue(user);

      const result = await QuietHoursService.isQuietTime('user-1');

      expect(result.isQuietTime).toBe(false);
      expect(result.reason).toBe('Invalid timezone configuration');
    });

    it('should handle missing user gracefully', async () => {
      MockedUser.findById.mockResolvedValue(null);

      const result = await QuietHoursService.isQuietTime('nonexistent-user');

      expect(result.isQuietTime).toBe(false);
      expect(result.reason).toBe('User not found');
    });
  });

  describe('Alert Processing with Quiet Hours', () => {
    it('should schedule alert when user is in quiet hours', async () => {
      const user = {
        ...baseUser,
        quiet_hours: {
          enabled: true,
          start_time: '22:00',
          end_time: '08:00',
          timezone: 'UTC',
          days: []
        }
      };
      MockedUser.findById.mockResolvedValue(user);

      // Mock current time to be during quiet hours
      const mockDate = new Date('2024-01-01T23:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());

      const mockAlert = {
        id: 'alert-1',
        user_id: 'user-1',
        product_id: 'product-1',
        retailer_id: 'retailer-1',
        type: 'restock' as const,
        priority: 'medium' as const,
        data: {
          product_name: 'Test Product',
          retailer_name: 'Test Retailer',
          availability_status: 'in_stock',
          product_url: 'https://example.com'
        },
        status: 'pending' as const,
        delivery_channels: [],
        retry_count: 0,
        created_at: new Date(),
        updated_at: new Date()
      };

      MockedAlert.createAlert.mockResolvedValue(mockAlert);
      MockedAlert.updateById.mockResolvedValue(mockAlert);

      const result = await AlertProcessingService.generateAlert({
        userId: 'user-1',
        productId: 'product-1',
        retailerId: 'retailer-1',
        type: 'restock',
        data: {
          product_name: 'Test Product',
          retailer_name: 'Test Retailer',
          availability_status: 'in_stock',
          product_url: 'https://example.com'
        }
      });

      expect(result.status).toBe('scheduled');
      expect(result.scheduledFor).toBeDefined();
      expect(MockedAlert.updateById).toHaveBeenCalledWith('alert-1', {
        scheduled_for: expect.any(Date),
        status: 'pending'
      });
    });

    it('should process alert immediately when not in quiet hours', async () => {
      const user = {
        ...baseUser,
        quiet_hours: {
          enabled: true,
          start_time: '22:00',
          end_time: '08:00',
          timezone: 'UTC',
          days: []
        }
      };
      MockedUser.findById.mockResolvedValue(user);

      // Mock current time to be outside quiet hours
      const mockDate = new Date('2024-01-01T12:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());

      const mockAlert = {
        id: 'alert-1',
        user_id: 'user-1',
        product_id: 'product-1',
        retailer_id: 'retailer-1',
        type: 'restock' as const,
        priority: 'medium' as const,
        data: {
          product_name: 'Test Product',
          retailer_name: 'Test Retailer',
          availability_status: 'in_stock',
          product_url: 'https://example.com'
        },
        status: 'pending' as const,
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

      const result = await AlertProcessingService.generateAlert({
        userId: 'user-1',
        productId: 'product-1',
        retailerId: 'retailer-1',
        type: 'restock',
        data: {
          product_name: 'Test Product',
          retailer_name: 'Test Retailer',
          availability_status: 'in_stock',
          product_url: 'https://example.com'
        }
      });

      expect(result.status).toBe('processed');
      expect(result.deliveryChannels).toEqual(['web_push']);
    });
  });

  describe('QuietHoursService.validateQuietHours', () => {
    it('should validate correct quiet hours configuration', () => {
      const validQuietHours: IQuietHours = {
        enabled: true,
        start_time: '22:00',
        end_time: '08:00',
        timezone: 'UTC',
        days: [0, 1, 2, 3, 4, 5, 6]
      };

      const result = QuietHoursService.validateQuietHours(validQuietHours);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject invalid time format', () => {
      const invalidQuietHours = {
        enabled: true,
        start_time: '25:00', // Invalid hour
        end_time: '08:00',
        timezone: 'UTC',
        days: []
      };

      const result = QuietHoursService.validateQuietHours(invalidQuietHours);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Start time must be in HH:MM format (24-hour)');
    });

    it('should reject invalid timezone', () => {
      const invalidQuietHours = {
        enabled: true,
        start_time: '22:00',
        end_time: '08:00',
        timezone: 'Invalid/Timezone',
        days: []
      };

      const result = QuietHoursService.validateQuietHours(invalidQuietHours);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid timezone provided');
    });

    it('should reject duplicate days', () => {
      const invalidQuietHours = {
        enabled: true,
        start_time: '22:00',
        end_time: '08:00',
        timezone: 'UTC',
        days: [0, 1, 1, 2] // Duplicate day 1
      };

      const result = QuietHoursService.validateQuietHours(invalidQuietHours);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Days array cannot contain duplicates');
    });

    it('should reject invalid day numbers', () => {
      const invalidQuietHours = {
        enabled: true,
        start_time: '22:00',
        end_time: '08:00',
        timezone: 'UTC',
        days: [0, 1, 7] // Day 7 is invalid (should be 0-6)
      };

      const result = QuietHoursService.validateQuietHours(invalidQuietHours);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Days must be integers between 0 and 6 (Sunday = 0)');
    });

    it('should reject same start and end time', () => {
      const invalidQuietHours = {
        enabled: true,
        start_time: '22:00',
        end_time: '22:00',
        timezone: 'UTC',
        days: []
      };

      const result = QuietHoursService.validateQuietHours(invalidQuietHours);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Start time and end time cannot be the same');
    });
  });

  describe('QuietHoursService.getOptimalNotificationTime', () => {
    it('should return immediate time when not in quiet hours', async () => {
      const user = {
        ...baseUser,
        quiet_hours: {
          enabled: false,
          start_time: '22:00',
          end_time: '08:00',
          timezone: 'UTC',
          days: []
        }
      };
      MockedUser.findById.mockResolvedValue(user);

      const preferredDelay = 5 * 60 * 1000; // 5 minutes
      const result = await QuietHoursService.getOptimalNotificationTime('user-1', preferredDelay);

      const expectedTime = new Date(Date.now() + preferredDelay);
      expect(result.getTime()).toBeCloseTo(expectedTime.getTime(), -3);
    });

    it('should return next active time when in quiet hours', async () => {
      const user = {
        ...baseUser,
        quiet_hours: {
          enabled: true,
          start_time: '22:00',
          end_time: '08:00',
          timezone: 'UTC',
          days: []
        }
      };
      MockedUser.findById.mockResolvedValue(user);

      // Mock current time to be during quiet hours
      const mockDate = new Date('2024-01-01T23:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());

      const result = await QuietHoursService.getOptimalNotificationTime('user-1');

      // Should return next morning at 08:00
      const expectedTime = new Date('2024-01-02T08:00:00Z');
      expect(result.getTime()).toBeCloseTo(expectedTime.getTime(), -3);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});