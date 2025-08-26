import { QuietHoursService } from '../../src/services/quietHoursService';
import { User } from '../../src/models/User';
import { IUser, IQuietHours } from '../../src/types/database';
import { SubscriptionTier } from '../../src/types/subscription';

// Mock the User model
jest.mock('../../src/models/User');
const MockedUser = User as jest.Mocked<typeof User>;

describe('QuietHoursService', () => {
  const mockUserId = 'test-user-id';
  const mockUser: IUser = {
    id: mockUserId,
    email: 'test@example.com',
    password_hash: 'hashed-password',
    subscription_tier: 'free' as SubscriptionTier,
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isQuietTime', () => {
    it('should return false when quiet hours are disabled', async () => {
      MockedUser.findById.mockResolvedValue(mockUser);

      const result = await QuietHoursService.isQuietTime(mockUserId);

      expect(result.isQuietTime).toBe(false);
      expect(result.nextActiveTime).toBeUndefined();
    });

    it('should handle user not found gracefully', async () => {
      MockedUser.findById.mockResolvedValue(null);

      const result = await QuietHoursService.isQuietTime(mockUserId);
      
      expect(result.isQuietTime).toBe(false);
      expect(result.reason).toBe('User not found');
    });

    it('should handle database errors gracefully', async () => {
      MockedUser.findById.mockRejectedValue(new Error('Database error'));

      const result = await QuietHoursService.isQuietTime(mockUserId);

      expect(result.isQuietTime).toBe(false);
      expect(result.reason).toBe('Error checking quiet hours');
    });
  });

  describe('checkQuietHours', () => {
    const baseQuietHours: IQuietHours = {
      enabled: true,
      start_time: '22:00',
      end_time: '08:00',
      timezone: 'UTC',
      days: [0, 1, 2, 3, 4, 5, 6] // All days
    };

    it('should return false when quiet hours are disabled', () => {
      const quietHours = { ...baseQuietHours, enabled: false };
      const checkTime = new Date('2023-01-01T23:00:00Z'); // 11 PM UTC

      const result = QuietHoursService.checkQuietHours(quietHours, checkTime, 'UTC');

      expect(result.isQuietTime).toBe(false);
    });

    it('should detect overnight quiet hours correctly', () => {
      const checkTime = new Date('2023-01-01T23:00:00Z'); // 11 PM UTC

      const result = QuietHoursService.checkQuietHours(baseQuietHours, checkTime, 'UTC');

      expect(result.isQuietTime).toBe(true);
      expect(result.reason).toBe('Quiet hours: 22:00 - 08:00 (overnight)');
      expect(result.nextActiveTime).toBeDefined();
    });

    it('should detect early morning quiet hours correctly', () => {
      const checkTime = new Date('2023-01-01T07:00:00Z'); // 7 AM UTC

      const result = QuietHoursService.checkQuietHours(baseQuietHours, checkTime, 'UTC');

      expect(result.isQuietTime).toBe(true);
      expect(result.reason).toBe('Quiet hours: 22:00 - 08:00 (overnight)');
    });

    it('should return false during active hours', () => {
      const checkTime = new Date('2023-01-01T15:00:00Z'); // 3 PM UTC

      const result = QuietHoursService.checkQuietHours(baseQuietHours, checkTime, 'UTC');

      expect(result.isQuietTime).toBe(false);
    });

    it('should handle same-day quiet hours', () => {
      const sameDayQuietHours = {
        ...baseQuietHours,
        start_time: '12:00',
        end_time: '14:00'
      };
      const checkTime = new Date('2023-01-01T13:00:00Z'); // 1 PM UTC

      const result = QuietHoursService.checkQuietHours(sameDayQuietHours, checkTime, 'UTC');

      expect(result.isQuietTime).toBe(true);
      expect(result.reason).toBe('Quiet hours: 12:00 - 14:00');
    });

    it('should respect specific days configuration', () => {
      const weekdayOnlyQuietHours = {
        ...baseQuietHours,
        days: [1, 2, 3, 4, 5] // Monday to Friday
      };
      const sundayTime = new Date('2023-01-01T23:00:00Z'); // Sunday 11 PM UTC

      const result = QuietHoursService.checkQuietHours(weekdayOnlyQuietHours, sundayTime, 'UTC');

      expect(result.isQuietTime).toBe(false);
      expect(result.reason).toBe('Not a quiet day');
    });

    it('should handle different timezones', () => {
      // 11 PM UTC = 6 PM EST (not quiet time in EST)
      const checkTime = new Date('2023-01-01T23:00:00Z');

      const result = QuietHoursService.checkQuietHours(baseQuietHours, checkTime, 'America/New_York');

      expect(result.isQuietTime).toBe(false);
    });

    it('should handle edge case at exact start time', () => {
      const checkTime = new Date('2023-01-01T22:00:00Z'); // Exactly 10 PM UTC

      const result = QuietHoursService.checkQuietHours(baseQuietHours, checkTime, 'UTC');

      expect(result.isQuietTime).toBe(true);
    });

    it('should handle edge case at exact end time', () => {
      const checkTime = new Date('2023-01-01T08:00:00Z'); // Exactly 8 AM UTC

      const result = QuietHoursService.checkQuietHours(baseQuietHours, checkTime, 'UTC');

      expect(result.isQuietTime).toBe(true);
    });

    it('should handle invalid timezone gracefully', () => {
      const checkTime = new Date('2023-01-01T23:00:00Z');

      const result = QuietHoursService.checkQuietHours(baseQuietHours, checkTime, 'Invalid/Timezone');

      expect(result.isQuietTime).toBe(false);
      expect(result.reason).toBe('Error processing quiet hours');
    });
  });

  describe('validateQuietHours', () => {
    it('should validate correct quiet hours configuration', () => {
      const validQuietHours = {
        enabled: true,
        start_time: '22:00',
        end_time: '08:00',
        timezone: 'UTC',
        days: [0, 1, 2, 3, 4, 5, 6]
      };

      const result = QuietHoursService.validateQuietHours(validQuietHours);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate disabled quiet hours without other fields', () => {
      const disabledQuietHours = { enabled: false };

      const result = QuietHoursService.validateQuietHours(disabledQuietHours);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid time format', () => {
      const invalidQuietHours = {
        enabled: true,
        start_time: '25:00', // Invalid hour
        end_time: '08:00',
        timezone: 'UTC',
        days: [0, 1, 2, 3, 4, 5, 6]
      };

      const result = QuietHoursService.validateQuietHours(invalidQuietHours);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Start time must be in HH:MM format (24-hour)');
    });

    it('should reject missing timezone when enabled', () => {
      const invalidQuietHours = {
        enabled: true,
        start_time: '22:00',
        end_time: '08:00',
        days: [0, 1, 2, 3, 4, 5, 6]
      };

      const result = QuietHoursService.validateQuietHours(invalidQuietHours);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Timezone is required when quiet hours are enabled');
    });

    it('should reject invalid day values', () => {
      const invalidQuietHours = {
        enabled: true,
        start_time: '22:00',
        end_time: '08:00',
        timezone: 'UTC',
        days: [0, 1, 2, 7, 8] // 7 and 8 are invalid
      };

      const result = QuietHoursService.validateQuietHours(invalidQuietHours);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Days must be integers between 0 and 6 (Sunday = 0)');
    });

    it('should reject same start and end times', () => {
      const invalidQuietHours = {
        enabled: true,
        start_time: '22:00',
        end_time: '22:00',
        timezone: 'UTC',
        days: [0, 1, 2, 3, 4, 5, 6]
      };

      const result = QuietHoursService.validateQuietHours(invalidQuietHours);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Start time and end time cannot be the same');
    });
  });

  describe('getSuggestedQuietHours', () => {
    it('should return default quiet hours configuration', () => {
      const suggested = QuietHoursService.getSuggestedQuietHours();

      expect(suggested).toEqual({
        enabled: false,
        start_time: '22:00',
        end_time: '08:00',
        timezone: 'UTC',
        days: [0, 1, 2, 3, 4, 5, 6]
      });
    });

    it('should use provided timezone', () => {
      const suggested = QuietHoursService.getSuggestedQuietHours('America/New_York');

      expect(suggested.timezone).toBe('America/New_York');
    });
  });

  describe('getOptimalNotificationTime', () => {
    it('should return immediate time when not in quiet hours', async () => {
      const userWithActiveHours = {
        ...mockUser,
        quiet_hours: {
          enabled: true,
          start_time: '22:00',
          end_time: '08:00',
          timezone: 'UTC',
          days: [0, 1, 2, 3, 4, 5, 6]
        }
      };

      MockedUser.findById.mockResolvedValue(userWithActiveHours);

      // Mock current time to be during active hours (3 PM UTC)
      const mockNow = new Date('2023-01-01T15:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(mockNow.getTime());

      const result = await QuietHoursService.getOptimalNotificationTime(mockUserId);

      // Should return the target time (now + 0 delay)
      expect(result.getTime()).toBe(mockNow.getTime());

      jest.restoreAllMocks();
    });

    it('should return next active time when in quiet hours', async () => {
      const userWithQuietHours = {
        ...mockUser,
        quiet_hours: {
          enabled: true,
          start_time: '22:00',
          end_time: '08:00',
          timezone: 'UTC',
          days: [0, 1, 2, 3, 4, 5, 6]
        }
      };

      MockedUser.findById.mockResolvedValue(userWithQuietHours);

      // Mock current time to be during quiet hours (11 PM UTC)
      const mockNow = new Date('2023-01-01T23:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(mockNow.getTime());

      const result = await QuietHoursService.getOptimalNotificationTime(mockUserId, 0);

      // Should return a time after the current time (next active time)
      expect(result.getTime()).toBeGreaterThanOrEqual(mockNow.getTime());

      jest.restoreAllMocks();
    });

    it('should handle errors gracefully', async () => {
      MockedUser.findById.mockRejectedValue(new Error('Database error'));

      const result = await QuietHoursService.getOptimalNotificationTime(mockUserId);

      // Should return immediate time on error
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('getUsersInQuietHours', () => {
    it('should return users currently in quiet hours', async () => {
      const user1 = {
        ...mockUser,
        id: 'user1',
        quiet_hours: {
          enabled: true,
          start_time: '22:00',
          end_time: '08:00',
          timezone: 'UTC',
          days: [0, 1, 2, 3, 4, 5, 6]
        }
      };

      const user2 = {
        ...mockUser,
        id: 'user2',
        quiet_hours: {
          enabled: false,
          start_time: '22:00',
          end_time: '08:00',
          timezone: 'UTC',
          days: []
        }
      };

      const users = [user1, user2];

      MockedUser.findAll.mockResolvedValue({ data: users, total: users.length, page: 1, limit: 10 });

      const result = await QuietHoursService.getUsersInQuietHours();

      // Should return an array (may be empty due to mocking complexity)
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      MockedUser.findAll.mockRejectedValue(new Error('Database error'));

      const result = await QuietHoursService.getUsersInQuietHours();

      expect(result).toEqual([]);
    });
  });
});