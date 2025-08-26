import { User } from '../models/User';
import { logger } from '../utils/logger';
import { IUser, IQuietHours } from '../types/database';

export interface QuietHoursCheck {
  isQuietTime: boolean;
  nextActiveTime?: Date;
  reason?: string;
}

export class QuietHoursService {
  /**
   * Check if current time is within user's quiet hours
   */
  static async isQuietTime(userId: string): Promise<QuietHoursCheck> {
    // Input validation
    if (!userId || typeof userId !== 'string') {
      logger.warn('Invalid userId provided to isQuietTime', { userId });
      return { isQuietTime: false, reason: 'Invalid user ID' };
    }

    try {
      const user = await User.findById<IUser>(userId);
      if (!user) {
        logger.warn('User not found for quiet hours check', { userId });
        return { isQuietTime: false, reason: 'User not found' };
      }

      const quietHours = user.quiet_hours;
      if (!quietHours?.enabled) {
        return { isQuietTime: false, reason: 'Quiet hours disabled' };
      }

      const now = new Date();
      const userTimezone = quietHours.timezone || user.timezone || 'UTC';

      // Validate timezone
      try {
        new Date().toLocaleString('en-US', { timeZone: userTimezone });
      } catch (timezoneError) {
        logger.warn('Invalid timezone for user', { userId, timezone: userTimezone });
        return { isQuietTime: false, reason: 'Invalid timezone configuration' };
      }

      return this.checkQuietHours(quietHours, now, userTimezone);
    } catch (error) {
      logger.error('Failed to check quiet hours', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      // Default to not quiet time if there's an error to avoid blocking notifications
      return { isQuietTime: false, reason: 'Error checking quiet hours' };
    }
  }

  /**
   * Check if a specific time is within quiet hours
   */
  static checkQuietHours(
    quietHours: IQuietHours,
    checkTime: Date,
    timezone: string = 'UTC'
  ): QuietHoursCheck {
    if (!quietHours.enabled) {
      return { isQuietTime: false };
    }

    try {
      // Convert check time to user's timezone
      const userTime = new Date(checkTime.toLocaleString('en-US', { timeZone: timezone }));
      const dayOfWeek = userTime.getDay(); // 0 = Sunday, 6 = Saturday
      const currentTimeStr = userTime.toTimeString().slice(0, 5); // HH:MM format

      // Check if today is in the quiet days
      if (quietHours.days.length > 0 && !quietHours.days.includes(dayOfWeek)) {
        return { isQuietTime: false, reason: 'Not a quiet day' };
      }

      const startTime = quietHours.start_time;
      const endTime = quietHours.end_time;

      // Handle same-day quiet hours (e.g., 22:00 to 23:59)
      if (startTime <= endTime) {
        const isQuiet = currentTimeStr >= startTime && currentTimeStr <= endTime;
        
        if (isQuiet) {
          const nextActiveTime = this.calculateNextActiveTime(userTime, quietHours, timezone);
          return { 
            isQuietTime: true, 
            nextActiveTime,
            reason: `Quiet hours: ${startTime} - ${endTime}` 
          };
        }
      } else {
        // Handle overnight quiet hours (e.g., 22:00 to 08:00)
        const isQuiet = currentTimeStr >= startTime || currentTimeStr <= endTime;
        
        if (isQuiet) {
          const nextActiveTime = this.calculateNextActiveTime(userTime, quietHours, timezone);
          return { 
            isQuietTime: true, 
            nextActiveTime,
            reason: `Quiet hours: ${startTime} - ${endTime} (overnight)` 
          };
        }
      }

      return { isQuietTime: false };
    } catch (error) {
      logger.error('Error checking quiet hours', {
        error: error instanceof Error ? error.message : 'Unknown error',
        quietHours,
        checkTime,
        timezone
      });
      return { isQuietTime: false, reason: 'Error processing quiet hours' };
    }
  }

  /**
   * Calculate when quiet hours will end
   */
  private static calculateNextActiveTime(
    currentTime: Date,
    quietHours: IQuietHours,
    timezone: string
  ): Date {
    try {
      const userTime = new Date(currentTime.toLocaleString('en-US', { timeZone: timezone }));
      const today = new Date(userTime);
      today.setHours(0, 0, 0, 0);

      const timeParts = quietHours.end_time.split(':').map(Number);
      const endHour = timeParts[0] ?? 0;
      const endMinute = timeParts[1] ?? 0;
      
      let nextActiveTime = new Date(today);
      nextActiveTime.setHours(endHour, endMinute, 0, 0);

      // If end time is earlier than start time (overnight), and current time is before end time,
      // the next active time is today at end time
      if (quietHours.start_time > quietHours.end_time) {
        const currentTimeStr = userTime.toTimeString().slice(0, 5);
        if (currentTimeStr <= quietHours.end_time) {
          // We're in the morning part of overnight quiet hours
          return nextActiveTime;
        } else {
          // We're in the evening part, so next active time is tomorrow at end time
          nextActiveTime.setDate(nextActiveTime.getDate() + 1);
        }
      } else {
        // Same-day quiet hours
        if (nextActiveTime <= userTime) {
          // If end time has passed today, next active time is tomorrow at end time
          nextActiveTime.setDate(nextActiveTime.getDate() + 1);
        }
      }

      // Convert back to UTC
      const utcOffset = nextActiveTime.getTimezoneOffset() * 60000;
      return new Date(nextActiveTime.getTime() + utcOffset);
    } catch (error) {
      logger.error('Error calculating next active time', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Default to 1 hour from now
      return new Date(Date.now() + 60 * 60 * 1000);
    }
  }

  /**
   * Get all users currently in quiet hours
   */
  static async getUsersInQuietHours(): Promise<string[]> {
    try {
      // This would typically be done with a database query for efficiency
      // For now, we'll implement a basic version
      const result = await User.findAll<IUser>();
      const users = Array.isArray(result) ? result : result.data;
      const usersInQuietHours: string[] = [];

      for (const user of users) {
        if (user.quiet_hours.enabled) {
          const quietCheck = await this.isQuietTime(user.id);
          if (quietCheck.isQuietTime) {
            usersInQuietHours.push(user.id);
          }
        }
      }

      return usersInQuietHours;
    } catch (error) {
      logger.error('Failed to get users in quiet hours', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Validate quiet hours configuration with comprehensive checks
   */
  static validateQuietHours(quietHours: Partial<IQuietHours>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Type validation
    if (typeof quietHours !== 'object' || quietHours === null) {
      errors.push('Quiet hours configuration must be an object');
      return { isValid: false, errors };
    }

    if (quietHours.enabled) {
      // Validate start_time format
      if (!this.isValidTimeFormat(quietHours.start_time)) {
        errors.push('Start time must be in HH:MM format (24-hour)');
      }

      // Validate end_time format
      if (!this.isValidTimeFormat(quietHours.end_time)) {
        errors.push('End time must be in HH:MM format (24-hour)');
      }

      // Validate timezone
      if (!quietHours.timezone || typeof quietHours.timezone !== 'string' || quietHours.timezone.trim().length === 0) {
        errors.push('Timezone is required when quiet hours are enabled');
      } else {
        // Test timezone validity
        try {
          new Date().toLocaleString('en-US', { timeZone: quietHours.timezone });
        } catch {
          errors.push('Invalid timezone provided');
        }
      }

      // Validate days array
      if (quietHours.days) {
        if (!Array.isArray(quietHours.days)) {
          errors.push('Days must be an array');
        } else {
          const uniqueDays = new Set(quietHours.days);
          if (uniqueDays.size !== quietHours.days.length) {
            errors.push('Days array cannot contain duplicates');
          }
          
          for (const day of quietHours.days) {
            if (!Number.isInteger(day) || day < 0 || day > 6) {
              errors.push('Days must be integers between 0 and 6 (Sunday = 0)');
              break;
            }
          }
        }
      }

      // Validate that start and end times are not the same
      if (quietHours.start_time === quietHours.end_time) {
        errors.push('Start time and end time cannot be the same');
      }

      // Validate time range makes sense (optional warning)
      if (quietHours.start_time && quietHours.end_time && 
          quietHours.start_time === quietHours.end_time) {
        errors.push('Quiet hours cannot span the entire day');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Helper method to validate time format
   */
  private static isValidTimeFormat(time: any): boolean {
    if (typeof time !== 'string') return false;
    return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
  }

  /**
   * Get suggested quiet hours based on user's timezone
   */
  static getSuggestedQuietHours(timezone: string = 'UTC'): IQuietHours {
    return {
      enabled: false,
      start_time: '22:00',
      end_time: '08:00',
      timezone,
      days: [0, 1, 2, 3, 4, 5, 6] // All days
    };
  }

  /**
   * Calculate optimal notification time outside quiet hours
   */
  static async getOptimalNotificationTime(userId: string, preferredDelay: number = 0): Promise<Date> {
    try {
      const targetTime = new Date(Date.now() + preferredDelay);
      const quietCheck = await this.isQuietTime(userId);

      if (!quietCheck.isQuietTime) {
        return targetTime;
      }

      // If we're in quiet hours, return the next active time
      return quietCheck.nextActiveTime || new Date(Date.now() + 60 * 60 * 1000);
    } catch (error) {
      logger.error('Failed to calculate optimal notification time', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Default to immediate delivery if there's an error
      return new Date();
    }
  }
}